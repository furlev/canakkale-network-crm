<?php
/**
 * Plugin Name: Çanakkale Network CRM Connector
 * Plugin URI: https://canakkale.network
 * Description: canakkale.network haber sitesi için CRM entegrasyon eklentisi. CRM sisteminin WordPress REST API üzerinden haberlere, kategorilere ve kullanıcılara erişimini sağlar.
 * Version: 1.0.0
 * Author: Çanakkale Network
 * Author URI: https://canakkale.network
 * License: GPL v2 or later
 * Text Domain: cn-crm-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CN_CRM_VERSION', '1.0.0');
define('CN_CRM_PLUGIN_DIR', plugin_dir_path(__FILE__));

class CN_CRM_Connector {
    
    private static $instance = null;
    private $api_key_option = 'cn_crm_api_key';
    private $webhook_url_option = 'cn_crm_webhook_url';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('publish_post', array($this, 'on_post_published'), 10, 2);
        add_action('transition_post_status', array($this, 'on_post_status_change'), 10, 3);
        
        // CORS headers for CRM subdomain
        add_action('rest_api_init', function() {
            remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
            add_filter('rest_pre_serve_request', array($this, 'add_cors_headers'));
        }, 15);
    }
    
    /**
     * Add CORS headers for CRM subdomain
     */
    public function add_cors_headers($value) {
        $origin = get_http_origin();
        $allowed_origins = array(
            'https://crm.canakkale.network',
            'http://crm.canakkale.network',
            'http://localhost:3000',
        );
        
        if (in_array($origin, $allowed_origins)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-CRM-API-Key');
            header('Access-Control-Allow-Credentials: true');
        }
        
        return $value;
    }
    
    /**
     * Verify API Key
     */
    private function verify_api_key($request) {
        $api_key = $request->get_header('X-CRM-API-Key');
        $stored_key = get_option($this->api_key_option);
        
        if (empty($stored_key)) {
            return true; // If no key set, allow access (development mode)
        }
        
        return $api_key === $stored_key;
    }
    
    /**
     * Permission check callback
     */
    public function check_permission($request) {
        return $this->verify_api_key($request);
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        $namespace = 'cn-crm/v1';
        
        // Posts/News endpoints
        register_rest_route($namespace, '/posts', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_posts'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 10, 'sanitize_callback' => 'absint'),
                'category' => array('sanitize_callback' => 'sanitize_text_field'),
                'search' => array('sanitize_callback' => 'sanitize_text_field'),
                'status' => array('default' => 'publish', 'sanitize_callback' => 'sanitize_text_field'),
                'orderby' => array('default' => 'date', 'sanitize_callback' => 'sanitize_text_field'),
                'order' => array('default' => 'DESC', 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
        
        register_rest_route($namespace, '/posts/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_post'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        register_rest_route($namespace, '/posts', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_post'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        register_rest_route($namespace, '/posts/(?P<id>\d+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_post'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Categories
        register_rest_route($namespace, '/categories', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_categories'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Tags
        register_rest_route($namespace, '/tags', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_tags'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Authors/Users
        register_rest_route($namespace, '/authors', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_authors'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Stats
        register_rest_route($namespace, '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Post stats (views, etc.)
        register_rest_route($namespace, '/posts/(?P<id>\d+)/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_post_stats'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Connection test
        register_rest_route($namespace, '/ping', array(
            'methods' => 'GET',
            'callback' => function() {
                return new WP_REST_Response(array(
                    'status' => 'ok',
                    'version' => CN_CRM_VERSION,
                    'site_name' => get_bloginfo('name'),
                    'site_url' => get_site_url(),
                    'timestamp' => current_time('mysql'),
                ), 200);
            },
            'permission_callback' => '__return_true',
        ));
        
        // Ihbar (News Tips) endpoint - receive tips from CRM
        register_rest_route($namespace, '/tips', array(
            'methods' => 'POST',
            'callback' => array($this, 'receive_tip'),
            'permission_callback' => array($this, 'check_permission'),
        ));
        
        // Convert tip to draft post
        register_rest_route($namespace, '/tips/convert', array(
            'methods' => 'POST',
            'callback' => array($this, 'convert_tip_to_post'),
            'permission_callback' => array($this, 'check_permission'),
        ));
    }
    
    /**
     * Get posts with extended data
     */
    public function get_posts($request) {
        $args = array(
            'post_type' => 'post',
            'post_status' => $request['status'],
            'posts_per_page' => min($request['per_page'], 100),
            'paged' => $request['page'],
            'orderby' => $request['orderby'],
            'order' => $request['order'],
        );
        
        if (!empty($request['category'])) {
            $args['category_name'] = $request['category'];
        }
        
        if (!empty($request['search'])) {
            $args['s'] = $request['search'];
        }
        
        $query = new WP_Query($args);
        $posts = array();
        
        foreach ($query->posts as $post) {
            $posts[] = $this->format_post($post);
        }
        
        return new WP_REST_Response(array(
            'posts' => $posts,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'current_page' => (int) $request['page'],
        ), 200);
    }
    
    /**
     * Get single post
     */
    public function get_post($request) {
        $post = get_post($request['id']);
        
        if (!$post) {
            return new WP_Error('not_found', 'Post bulunamadı', array('status' => 404));
        }
        
        return new WP_REST_Response($this->format_post($post, true), 200);
    }
    
    /**
     * Create new post
     */
    public function create_post($request) {
        $body = $request->get_json_params();
        
        $post_data = array(
            'post_title' => sanitize_text_field($body['title']),
            'post_content' => wp_kses_post($body['content']),
            'post_status' => isset($body['status']) ? $body['status'] : 'draft',
            'post_author' => isset($body['author_id']) ? absint($body['author_id']) : get_current_user_id(),
            'post_category' => isset($body['categories']) ? array_map('absint', $body['categories']) : array(),
        );
        
        if (isset($body['excerpt'])) {
            $post_data['post_excerpt'] = sanitize_text_field($body['excerpt']);
        }
        
        $post_id = wp_insert_post($post_data, true);
        
        if (is_wp_error($post_id)) {
            return $post_id;
        }
        
        // Add tags
        if (isset($body['tags']) && is_array($body['tags'])) {
            wp_set_post_tags($post_id, $body['tags']);
        }
        
        // Add CRM meta
        update_post_meta($post_id, '_cn_crm_source', 'crm');
        if (isset($body['tip_id'])) {
            update_post_meta($post_id, '_cn_crm_tip_id', sanitize_text_field($body['tip_id']));
        }
        
        $post = get_post($post_id);
        return new WP_REST_Response($this->format_post($post), 201);
    }
    
    /**
     * Update post
     */
    public function update_post($request) {
        $body = $request->get_json_params();
        $post_id = $request['id'];
        
        $post = get_post($post_id);
        if (!$post) {
            return new WP_Error('not_found', 'Post bulunamadı', array('status' => 404));
        }
        
        $post_data = array('ID' => $post_id);
        
        if (isset($body['title'])) $post_data['post_title'] = sanitize_text_field($body['title']);
        if (isset($body['content'])) $post_data['post_content'] = wp_kses_post($body['content']);
        if (isset($body['status'])) $post_data['post_status'] = $body['status'];
        if (isset($body['excerpt'])) $post_data['post_excerpt'] = sanitize_text_field($body['excerpt']);
        
        $result = wp_update_post($post_data, true);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        $updated_post = get_post($post_id);
        return new WP_REST_Response($this->format_post($updated_post), 200);
    }
    
    /**
     * Format post data for API response
     */
    private function format_post($post, $full = false) {
        $categories = wp_get_post_categories($post->ID, array('fields' => 'all'));
        $tags = wp_get_post_tags($post->ID, array('fields' => 'all'));
        $author = get_userdata($post->post_author);
        $thumbnail = get_the_post_thumbnail_url($post->ID, 'large');
        
        $data = array(
            'id' => $post->ID,
            'title' => $post->post_title,
            'slug' => $post->post_name,
            'excerpt' => wp_trim_words($post->post_excerpt ?: $post->post_content, 30),
            'status' => $post->post_status,
            'date' => $post->post_date,
            'modified' => $post->post_modified,
            'url' => get_permalink($post->ID),
            'thumbnail' => $thumbnail ?: null,
            'author' => array(
                'id' => $author->ID,
                'name' => $author->display_name,
                'avatar' => get_avatar_url($author->ID),
            ),
            'categories' => array_map(function($cat) {
                return array(
                    'id' => $cat->term_id,
                    'name' => $cat->name,
                    'slug' => $cat->slug,
                );
            }, $categories),
            'tags' => array_map(function($tag) {
                return array(
                    'id' => $tag->term_id,
                    'name' => $tag->name,
                    'slug' => $tag->slug,
                );
            }, $tags),
            'views' => (int) get_post_meta($post->ID, '_cn_post_views', true) ?: 0,
            'crm_source' => get_post_meta($post->ID, '_cn_crm_source', true) ?: null,
            'tip_id' => get_post_meta($post->ID, '_cn_crm_tip_id', true) ?: null,
        );
        
        if ($full) {
            $data['content'] = apply_filters('the_content', $post->post_content);
            $data['raw_content'] = $post->post_content;
            $data['comment_count'] = (int) $post->comment_count;
        }
        
        return $data;
    }
    
    /**
     * Get categories
     */
    public function get_categories($request) {
        $categories = get_categories(array(
            'hide_empty' => false,
            'orderby' => 'count',
            'order' => 'DESC',
        ));
        
        $data = array_map(function($cat) {
            return array(
                'id' => $cat->term_id,
                'name' => $cat->name,
                'slug' => $cat->slug,
                'count' => $cat->count,
                'description' => $cat->description,
                'parent' => $cat->parent,
            );
        }, $categories);
        
        return new WP_REST_Response($data, 200);
    }
    
    /**
     * Get tags
     */
    public function get_tags($request) {
        $tags = get_tags(array(
            'hide_empty' => false,
            'orderby' => 'count',
            'order' => 'DESC',
            'number' => 100,
        ));
        
        $data = array_map(function($tag) {
            return array(
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'count' => $tag->count,
            );
        }, $tags);
        
        return new WP_REST_Response($data, 200);
    }
    
    /**
     * Get authors
     */
    public function get_authors($request) {
        $users = get_users(array(
            'role__in' => array('administrator', 'editor', 'author', 'contributor'),
            'orderby' => 'display_name',
        ));
        
        $data = array_map(function($user) {
            return array(
                'id' => $user->ID,
                'name' => $user->display_name,
                'email' => $user->user_email,
                'role' => implode(', ', $user->roles),
                'avatar' => get_avatar_url($user->ID),
                'post_count' => count_user_posts($user->ID),
                'registered' => $user->user_registered,
            );
        }, $users);
        
        return new WP_REST_Response($data, 200);
    }
    
    /**
     * Get site stats
     */
    public function get_stats($request) {
        global $wpdb;
        
        $total_posts = wp_count_posts();
        $today_start = date('Y-m-d 00:00:00');
        $week_start = date('Y-m-d 00:00:00', strtotime('-7 days'));
        
        $today_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_date >= %s",
            $today_start
        ));
        
        $week_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_date >= %s",
            $week_start
        ));
        
        return new WP_REST_Response(array(
            'total_published' => (int) $total_posts->publish,
            'total_draft' => (int) $total_posts->draft,
            'total_pending' => (int) $total_posts->pending,
            'today' => (int) $today_count,
            'this_week' => (int) $week_count,
            'total_categories' => wp_count_terms('category'),
            'total_tags' => wp_count_terms('post_tag'),
            'total_authors' => count(get_users(array('role__in' => array('administrator', 'editor', 'author')))),
        ), 200);
    }
    
    /**
     * Get post stats
     */
    public function get_post_stats($request) {
        $post_id = $request['id'];
        $post = get_post($post_id);
        
        if (!$post) {
            return new WP_Error('not_found', 'Post bulunamadı', array('status' => 404));
        }
        
        return new WP_REST_Response(array(
            'views' => (int) get_post_meta($post_id, '_cn_post_views', true) ?: 0,
            'comments' => (int) $post->comment_count,
            'word_count' => str_word_count(strip_tags($post->post_content)),
        ), 200);
    }
    
    /**
     * Receive tip from CRM
     */
    public function receive_tip($request) {
        $body = $request->get_json_params();
        
        // Store tip as a custom post type or in options
        $tip_data = array(
            'subject' => sanitize_text_field($body['subject']),
            'content' => wp_kses_post($body['content']),
            'source' => sanitize_text_field($body['source']),
            'priority' => sanitize_text_field($body['priority']),
            'received_at' => current_time('mysql'),
            'crm_tip_id' => sanitize_text_field($body['tip_id']),
        );
        
        $tips = get_option('cn_crm_tips', array());
        $tips[] = $tip_data;
        update_option('cn_crm_tips', $tips);
        
        return new WP_REST_Response(array(
            'status' => 'received',
            'message' => 'İhbar başarıyla alındı',
        ), 201);
    }
    
    /**
     * Convert tip to draft post
     */
    public function convert_tip_to_post($request) {
        $body = $request->get_json_params();
        
        $post_data = array(
            'post_title' => sanitize_text_field($body['title']),
            'post_content' => wp_kses_post($body['content']),
            'post_status' => 'draft',
            'post_author' => isset($body['author_id']) ? absint($body['author_id']) : 1,
        );
        
        if (isset($body['categories'])) {
            $post_data['post_category'] = array_map('absint', $body['categories']);
        }
        
        $post_id = wp_insert_post($post_data, true);
        
        if (is_wp_error($post_id)) {
            return $post_id;
        }
        
        // Mark as converted from tip
        update_post_meta($post_id, '_cn_crm_source', 'tip');
        update_post_meta($post_id, '_cn_crm_tip_id', sanitize_text_field($body['tip_id']));
        
        return new WP_REST_Response(array(
            'status' => 'converted',
            'post_id' => $post_id,
            'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
        ), 201);
    }
    
    /**
     * Webhook: Notify CRM when post is published
     */
    public function on_post_published($post_id, $post) {
        $webhook_url = get_option($this->webhook_url_option);
        if (empty($webhook_url)) return;
        
        $data = array(
            'event' => 'post_published',
            'post' => $this->format_post($post),
            'timestamp' => current_time('mysql'),
        );
        
        wp_remote_post($webhook_url, array(
            'body' => json_encode($data),
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-CRM-Webhook' => 'post_published',
            ),
            'timeout' => 10,
            'blocking' => false,
        ));
    }
    
    /**
     * Webhook: Notify CRM on post status change
     */
    public function on_post_status_change($new_status, $old_status, $post) {
        if ($new_status === $old_status) return;
        if ($post->post_type !== 'post') return;
        
        $webhook_url = get_option($this->webhook_url_option);
        if (empty($webhook_url)) return;
        
        $data = array(
            'event' => 'post_status_changed',
            'post_id' => $post->ID,
            'old_status' => $old_status,
            'new_status' => $new_status,
            'timestamp' => current_time('mysql'),
        );
        
        wp_remote_post($webhook_url, array(
            'body' => json_encode($data),
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-CRM-Webhook' => 'post_status_changed',
            ),
            'timeout' => 10,
            'blocking' => false,
        ));
    }
    
    /**
     * Admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'CRM Connector Ayarları',
            'CRM Connector',
            'manage_options',
            'cn-crm-connector',
            array($this, 'render_settings_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('cn_crm_settings', $this->api_key_option);
        register_setting('cn_crm_settings', $this->webhook_url_option);
    }
    
    /**
     * Settings page
     */
    public function render_settings_page() {
        $api_key = get_option($this->api_key_option);
        $webhook_url = get_option($this->webhook_url_option);
        ?>
        <div class="wrap">
            <h1>🔗 CRM Connector Ayarları</h1>
            <p>Çanakkale Network CRM sisteminizi WordPress sitenize bağlayın.</p>
            
            <form method="post" action="options.php">
                <?php settings_fields('cn_crm_settings'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">API Anahtarı</th>
                        <td>
                            <input type="text" name="<?php echo $this->api_key_option; ?>" 
                                   value="<?php echo esc_attr($api_key); ?>" 
                                   class="regular-text" 
                                   placeholder="CRM API anahtarınızı girin" />
                            <p class="description">CRM Ayarlar → API bölümünden alabilirsiniz. Boş bırakırsanız tüm istekler kabul edilir (geliştirme modu).</p>
                            <button type="button" class="button" onclick="document.querySelector('input[name=<?php echo $this->api_key_option; ?>]').value = '<?php echo wp_generate_password(32, false); ?>'">
                                Yeni Anahtar Oluştur
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Webhook URL</th>
                        <td>
                            <input type="url" name="<?php echo $this->webhook_url_option; ?>" 
                                   value="<?php echo esc_attr($webhook_url); ?>" 
                                   class="regular-text" 
                                   placeholder="https://crm.canakkale.network/api/wordpress/webhook" />
                            <p class="description">Yeni haber yayınlandığında CRM'e bildirim göndermek için webhook URL'si.</p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button('Ayarları Kaydet'); ?>
            </form>
            
            <hr />
            
            <h2>API Endpoint'leri</h2>
            <table class="widefat">
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Method</th>
                        <th>Açıklama</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td><code>/wp-json/cn-crm/v1/ping</code></td><td>GET</td><td>Bağlantı testi</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/posts</code></td><td>GET</td><td>Haberleri listele</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/posts</code></td><td>POST</td><td>Yeni haber oluştur</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/posts/{id}</code></td><td>GET</td><td>Haber detayı</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/posts/{id}</code></td><td>PUT</td><td>Haber güncelle</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/categories</code></td><td>GET</td><td>Kategoriler</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/tags</code></td><td>GET</td><td>Etiketler</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/authors</code></td><td>GET</td><td>Yazarlar</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/stats</code></td><td>GET</td><td>Site istatistikleri</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/tips</code></td><td>POST</td><td>İhbar gönder</td></tr>
                    <tr><td><code>/wp-json/cn-crm/v1/tips/convert</code></td><td>POST</td><td>İhbarı habere dönüştür</td></tr>
                </tbody>
            </table>
            
            <hr />
            
            <h2>Bağlantı Testi</h2>
            <p>
                <button type="button" class="button button-primary" onclick="testConnection()">
                    Bağlantıyı Test Et
                </button>
                <span id="cn-crm-test-result" style="margin-left: 10px;"></span>
            </p>
            
            <script>
            function testConnection() {
                var result = document.getElementById('cn-crm-test-result');
                result.innerHTML = '⏳ Test ediliyor...';
                
                fetch('<?php echo rest_url('cn-crm/v1/ping'); ?>')
                    .then(r => r.json())
                    .then(data => {
                        result.innerHTML = '✅ Bağlantı başarılı! Site: ' + data.site_name + ' | Sürüm: ' + data.version;
                        result.style.color = 'green';
                    })
                    .catch(err => {
                        result.innerHTML = '❌ Bağlantı hatası: ' + err.message;
                        result.style.color = 'red';
                    });
            }
            </script>
        </div>
        <?php
    }
}

// Track post views
function cn_crm_track_views() {
    if (is_single()) {
        global $post;
        $views = (int) get_post_meta($post->ID, '_cn_post_views', true);
        update_post_meta($post->ID, '_cn_post_views', $views + 1);
    }
}
add_action('wp_head', 'cn_crm_track_views');

// Initialize
CN_CRM_Connector::get_instance();
