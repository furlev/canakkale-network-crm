<?php
/**
 * Plugin Name: Çanakkale Network CRM Connector
 * Plugin URI: https://canakkale.network
 * Description: canakkale.network haber sitesi için CRM entegrasyon eklentisi. CRM sisteminin WordPress REST API üzerinden haberlere, kategorilere ve kullanıcılara erişimini sağlar.
 * Version: 1.2.0
 * Author: Çanakkale Network
 * Author URI: https://canakkale.network
 * License: GPL v2 or later
 * Text Domain: cn-crm-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CN_CRM_VERSION', '1.2.0');
define('CN_CRM_PLUGIN_DIR', plugin_dir_path(__FILE__));

class CN_CRM_Connector {
    
    private static $instance = null;
    private $api_key_option = 'cn_crm_api_key';
    private $webhook_url_option = 'cn_crm_webhook_url';
    private $crm_url_option = 'cn_crm_base_url';
    private $ai_secret_option = 'cn_crm_ai_secret';
    
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

        // AI: haber editörüne analiz kutusu + sunucu-tarafı proxy
        add_action('add_meta_boxes', array($this, 'add_ai_meta_box'));
        add_action('wp_ajax_cn_crm_ai_analyze', array($this, 'ajax_ai_analyze'));
        
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

        // GÜVENLİK: anahtar ayarlanmadan HİÇBİR istek kabul edilmez (fail-closed).
        // Aksi halde anahtarsız bir kurulumda tüm yazma/okuma uçları herkese açık kalırdı.
        if (empty($stored_key)) {
            return false;
        }
        if (empty($api_key) || !is_string($api_key)) {
            return false;
        }
        return hash_equals((string) $stored_key, (string) $api_key); // sabit-zamanlı
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
                // Artımlı senkron: yalnızca bu ISO8601 tarihten sonra DEĞİŞEN yazılar (post_modified_gmt)
                'modified_after' => array('sanitize_callback' => 'sanitize_text_field'),
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

        // Artımlı senkron: modified_after (ISO8601, UTC) → post_modified_gmt üzerinden filtre
        if (!empty($request['modified_after'])) {
            $ts = strtotime($request['modified_after']);
            if ($ts !== false) {
                $args['date_query'] = array(
                    array(
                        'column'    => 'post_modified_gmt',
                        'after'     => gmdate('Y-m-d H:i:s', $ts),
                        'inclusive' => true,
                    ),
                );
            }
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

        // Zorunlu alan doğrulaması (aksi halde PHP notice + boş başlıklı yayın)
        if (!is_array($body) || empty($body['title'])) {
            return new WP_Error('missing_title', 'Başlık (title) gerekli', array('status' => 400));
        }

        $post_data = array(
            'post_title' => sanitize_text_field($body['title']),
            'post_content' => isset($body['content']) ? wp_kses_post($body['content']) : '',
            'post_status' => isset($body['status']) ? sanitize_key($body['status']) : 'draft',
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
        
        // Add tags (wp_set_post_tags isim kabul eder, yoksa oluşturur)
        if (isset($body['tags']) && is_array($body['tags'])) {
            wp_set_post_tags($post_id, $body['tags']);
        }

        // Öne çıkan "temsili" görsel: base64 data URI -> medya kütüphanesine sideload
        if (!empty($body['featured_image_base64'])) {
            $att_id = $this->sideload_base64_image(
                $body['featured_image_base64'],
                $post_id,
                isset($body['title']) ? $body['title'] : ''
            );
            if (!is_wp_error($att_id) && $att_id) {
                set_post_thumbnail($post_id, $att_id);
            }
        }

        // SEO meta (Yoast + Rank Math + AIOSEO — hangisi aktifse o okur)
        $this->apply_seo_meta($post_id, $body);

        // Add CRM meta
        update_post_meta($post_id, '_cn_crm_source', 'crm');
        if (isset($body['tip_id'])) {
            update_post_meta($post_id, '_cn_crm_tip_id', sanitize_text_field($body['tip_id']));
        }
        // Temsili görsel işareti (şablon/altyazı için)
        if (!empty($body['featured_image_base64'])) {
            update_post_meta($post_id, '_cn_crm_ai_image', '1');
        }

        $post = get_post($post_id);
        return new WP_REST_Response($this->format_post($post), 201);
    }

    /**
     * SEO eklentisine (Yoast/Rank Math/AIOSEO) başlık + meta açıklama yaz.
     */
    private function apply_seo_meta($post_id, $body) {
        if (!empty($body['seo_title'])) {
            $st = sanitize_text_field($body['seo_title']);
            update_post_meta($post_id, '_yoast_wpseo_title', $st);
            update_post_meta($post_id, 'rank_math_title', $st);
            update_post_meta($post_id, '_aioseo_title', $st);
        }
        if (!empty($body['meta_description'])) {
            $md = sanitize_text_field($body['meta_description']);
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $md);
            update_post_meta($post_id, 'rank_math_description', $md);
            update_post_meta($post_id, '_aioseo_description', $md);
        }
    }

    /**
     * base64 (data URI ya da düz) görseli medya kütüphanesine yükler, attachment ID döner.
     */
    private function sideload_base64_image($data_uri, $post_id, $title = '') {
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $alt = $title ?: 'Temsili görsel';

        // 1) Düz http(s) URL ise WP'nin güvenli sideload'unu kullan (indirir + doğrular)
        if (is_string($data_uri) && preg_match('#^https?://#i', $data_uri)) {
            $att_id = media_sideload_image($data_uri, $post_id, $alt, 'id');
            if (!is_wp_error($att_id) && $att_id) {
                update_post_meta($att_id, '_wp_attachment_image_alt', $alt);
                update_post_meta($att_id, '_cn_crm_ai_image', '1');
            }
            return $att_id;
        }

        // 2) data URI / düz base64 → çöz
        $b64 = $data_uri;
        if (preg_match('#^data:[^;,]+;base64,(.*)$#s', (string) $data_uri, $m)) {
            $b64 = $m[1];
        }
        $bytes = base64_decode($b64, true);
        if ($bytes === false || strlen($bytes) < 100) {
            return new WP_Error('bad_image', 'Görsel çözümlenemedi');
        }

        // 3) GÜVENLİK: türü GERÇEK içerikten doğrula (istemci MIME'sine GÜVENME);
        //    yalnızca güvenli raster türlere izin ver → SVG (XSS) ve diğerleri reddedilir.
        $info = @getimagesizefromstring($bytes);
        if ($info === false || empty($info['mime'])) {
            return new WP_Error('bad_image', 'Geçerli bir görsel değil');
        }
        $allowed = array(
            'image/png'  => 'png',
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            'image/gif'  => 'gif',
        );
        $mime = $info['mime'];
        if (!isset($allowed[$mime])) {
            return new WP_Error('bad_image_type', 'Desteklenmeyen görsel türü: ' . $mime);
        }
        $ext = $allowed[$mime];

        $slug = sanitize_title($title ?: ('crm-haber-' . $post_id));
        $filename = substr($slug ?: 'crm-haber', 0, 60) . '-' . $post_id . '.' . $ext;

        $upload = wp_upload_bits($filename, null, $bytes);
        if (!empty($upload['error'])) {
            return new WP_Error('upload_error', $upload['error']);
        }

        $attachment = array(
            'post_mime_type' => $mime,
            'post_title' => $title ?: ('CRM Haber Görseli ' . $post_id),
            'post_content' => '',
            'post_status' => 'inherit',
        );
        $att_id = wp_insert_attachment($attachment, $upload['file'], $post_id);
        if (is_wp_error($att_id)) {
            return $att_id;
        }
        $meta = wp_generate_attachment_metadata($att_id, $upload['file']);
        wp_update_attachment_metadata($att_id, $meta);
        update_post_meta($att_id, '_wp_attachment_image_alt', $alt);
        update_post_meta($att_id, '_cn_crm_ai_image', '1');
        return $att_id;
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
        register_setting('cn_crm_settings', $this->crm_url_option);
        register_setting('cn_crm_settings', $this->ai_secret_option);
    }

    /**
     * Haber editörüne AI analiz kutusu ekle
     */
    public function add_ai_meta_box() {
        add_meta_box('cn_crm_ai', '🤖 CRM AI Analiz', array($this, 'render_ai_meta_box'), 'post', 'side', 'high');
    }

    public function render_ai_meta_box($post) {
        $crm_url = get_option($this->crm_url_option);
        if (empty($crm_url)) {
            echo '<p>Önce <a href="' . esc_url(admin_url('options-general.php?page=cn-crm-connector')) . '">CRM Connector ayarlarından</a> CRM adresini ve AI secret değerini girin.</p>';
            return;
        }
        $nonce = wp_create_nonce('cn_crm_ai_' . $post->ID);
        ?>
        <p style="color:#666;font-size:12px;">Başlık ve içerikten AI ile özet, SEO başlık, meta açıklama, etiket ve sosyal medya metni üretir.</p>
        <button type="button" class="button button-primary" id="cn-ai-btn" data-post="<?php echo (int) $post->ID; ?>" data-nonce="<?php echo esc_attr($nonce); ?>" style="width:100%;">✨ AI ile Analiz Et</button>
        <div id="cn-ai-result" style="margin-top:12px;font-size:13px;"></div>
        <script>
        (function(){
            var btn = document.getElementById('cn-ai-btn');
            if (!btn) return;
            btn.addEventListener('click', function(){
                var box = document.getElementById('cn-ai-result');
                box.innerHTML = '⏳ Analiz ediliyor...';
                btn.disabled = true;
                var data = new FormData();
                data.append('action', 'cn_crm_ai_analyze');
                data.append('post_id', btn.dataset.post);
                data.append('_nonce', btn.dataset.nonce);
                // Editördeki güncel başlık/içeriği de gönder (kaydetmeden çalışsın)
                var titleEl = document.getElementById('title');
                if (titleEl) data.append('title', titleEl.value);
                if (window.tinymce && window.tinymce.get('content') && !window.tinymce.get('content').isHidden()) {
                    data.append('content', window.tinymce.get('content').getContent({format:'text'}));
                } else {
                    var ce = document.getElementById('content');
                    if (ce) data.append('content', ce.value);
                }
                fetch(ajaxurl, { method:'POST', body:data, credentials:'same-origin' })
                    .then(function(r){ return r.json(); })
                    .then(function(res){
                        btn.disabled = false;
                        if (!res.success) { box.innerHTML = '<span style="color:#c00;">❌ ' + (res.data && res.data.message ? res.data.message : 'Hata') + '</span>'; return; }
                        var d = res.data;
                        var esc = function(s){ var e=document.createElement('div'); e.textContent=s||''; return e.innerHTML; };
                        box.innerHTML =
                          '<p><strong>SEO Başlık:</strong><br>' + esc(d.seoTitle) + '</p>' +
                          '<p><strong>Meta Açıklama:</strong><br>' + esc(d.metaDescription) + '</p>' +
                          '<p><strong>Özet:</strong><br>' + esc(d.summary) + '</p>' +
                          '<p><strong>Önerilen Kategori:</strong> ' + esc(d.category) + '</p>' +
                          '<p><strong>Etiketler:</strong> ' + (d.tags||[]).map(esc).join(', ') + '</p>' +
                          '<p><strong>Sosyal Medya:</strong><br>' + esc(d.socialPost) + '</p>';
                        var tagBtn = document.createElement('button');
                        tagBtn.type='button'; tagBtn.className='button'; tagBtn.style.width='100%'; tagBtn.textContent='🏷️ Etiketleri Ekle';
                        tagBtn.onclick = function(){
                            var input = document.querySelector('#new-tag-post_tag, textarea.the-tags');
                            if (input) { input.value = (input.value ? input.value + ', ' : '') + (d.tags||[]).join(', '); }
                            var add = document.querySelector('.tagadd'); if (add) add.click();
                            tagBtn.textContent = '✓ Etiketler eklendi';
                        };
                        box.appendChild(tagBtn);
                        var note = document.createElement('p'); note.style='font-size:11px;color:#999;margin-top:8px;'; note.textContent='🤖 Gemini önerisi — yayından önce kontrol edin'; box.appendChild(note);
                    })
                    .catch(function(){ btn.disabled = false; box.innerHTML = '<span style="color:#c00;">❌ Sunucuya ulaşılamadı</span>'; });
            });
        })();
        </script>
        <?php
    }

    /**
     * Editörden gelen başlık/içeriği CRM AI ucuna sunucu-tarafı iletir (secret tarayıcıya sızmaz)
     */
    public function ajax_ai_analyze() {
        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(array('message' => 'Yetkisiz'));
        }
        if (!isset($_POST['_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_nonce'])), 'cn_crm_ai_' . $post_id)) {
            wp_send_json_error(array('message' => 'Geçersiz istek'));
        }

        $crm_url = rtrim(get_option($this->crm_url_option), '/');
        $secret  = get_option($this->ai_secret_option);
        if (empty($crm_url) || empty($secret)) {
            wp_send_json_error(array('message' => 'CRM adresi/AI secret ayarlanmamış'));
        }

        $title   = isset($_POST['title']) ? sanitize_text_field(wp_unslash($_POST['title'])) : get_the_title($post_id);
        $content = isset($_POST['content']) ? wp_strip_all_tags(wp_unslash($_POST['content'])) : wp_strip_all_tags(get_post_field('post_content', $post_id));
        if (strlen(trim($content)) < 20) {
            wp_send_json_error(array('message' => 'İçerik çok kısa'));
        }

        $resp = wp_remote_post($crm_url . '/api/ai/analyze-article', array(
            'timeout' => 45,
            'headers' => array(
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $secret,
            ),
            'body' => wp_json_encode(array('title' => $title, 'content' => mb_substr($content, 0, 8000))),
        ));

        if (is_wp_error($resp)) {
            wp_send_json_error(array('message' => 'CRM\'e ulaşılamadı: ' . $resp->get_error_message()));
        }
        $code = wp_remote_retrieve_response_code($resp);
        $data = json_decode(wp_remote_retrieve_body($resp), true);
        if ($code !== 200 || !is_array($data)) {
            wp_send_json_error(array('message' => isset($data['error']) ? $data['error'] : ('CRM hata: HTTP ' . $code)));
        }
        wp_send_json_success($data);
    }
    
    /**
     * Settings page
     */
    public function render_settings_page() {
        $api_key = get_option($this->api_key_option);
        $webhook_url = get_option($this->webhook_url_option);
        $crm_url = get_option($this->crm_url_option);
        $ai_secret = get_option($this->ai_secret_option);
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
                            <p class="description"><strong>Zorunlu.</strong> CRM Ayarlar → WordPress bölümündeki API anahtarıyla AYNI olmalı. Boş bırakılırsa güvenlik için tüm CRM istekleri reddedilir (yayın/senkron çalışmaz).</p>
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
                    <tr>
                        <th scope="row">CRM Adresi (AI için)</th>
                        <td>
                            <input type="url" name="<?php echo $this->crm_url_option; ?>"
                                   value="<?php echo esc_attr($crm_url); ?>"
                                   class="regular-text"
                                   placeholder="https://crm.canakkale.network" />
                            <p class="description">Haber editöründeki AI analiz kutusunun çağıracağı CRM kök adresi (sondaki / olmadan).</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">AI Secret</th>
                        <td>
                            <input type="password" name="<?php echo $this->ai_secret_option; ?>"
                                   value="<?php echo esc_attr($ai_secret); ?>"
                                   class="regular-text" />
                            <p class="description">CRM sunucusundaki <code>WEBHOOK_SECRET</code> değeriyle aynı olmalı (AI analiz ucunu yetkilendirir).</p>
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
