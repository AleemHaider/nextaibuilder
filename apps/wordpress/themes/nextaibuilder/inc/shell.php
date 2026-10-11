<?php
/**
 * Render a PHP-driven page (Tutor overrides) inside the block theme's header
 * and footer. Blocks are rendered before wp_head() so their styles are enqueued.
 *
 * @package nextaibuilder
 */

defined( 'ABSPATH' ) || exit;

/**
 * Output a full document around already-built main content.
 *
 * @param string $main_html Escaped HTML for <main>.
 */
function nextaibuilder_render_shell( $main_html ) {
	$header = do_blocks( '<!-- wp:template-part {"slug":"header","theme":"nextaibuilder","tagName":"header"} /-->' );
	$footer = do_blocks( '<!-- wp:template-part {"slug":"footer","theme":"nextaibuilder","tagName":"footer"} /-->' );
	?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<?php if ( ! current_theme_supports( 'title-tag' ) ) : ?>
	<title><?php echo esc_html( wp_get_document_title() ); ?></title>
	<?php endif; ?>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div class="wp-site-blocks">
	<?php echo $header; // phpcs:ignore WordPress.Security.EscapeOutput -- rendered blocks. ?>
	<main id="main" class="nab-main"><?php echo $main_html; // phpcs:ignore WordPress.Security.EscapeOutput -- built from escaped parts. ?></main>
	<?php echo $footer; // phpcs:ignore WordPress.Security.EscapeOutput -- rendered blocks. ?>
</div>
<?php wp_footer(); ?>
</body>
</html>
	<?php
}
