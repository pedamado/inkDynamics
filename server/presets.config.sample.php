<?php
// InkDynamics 4.0 — settings of server/presets.php. Copy this file to presets.config.php (never commit that copy).
return [
  // The hash of the write token — never the token itself. Make a long random token, keep it somewhere safe, and put
  // its hash here:   php -r "echo password_hash('the-token', PASSWORD_DEFAULT), PHP_EOL;"
  // Empty: nobody can write.
  'token_hash' => '',
  // true: reading the presets needs the token too (default: anyone who can reach the endpoint can read them)
  'read_needs_token' => false,
  // where the lists are kept — best OUTSIDE the web root (the data/ folder here is denied by its .htaccess on Apache)
  'data_dir' => __DIR__ . '/data',
  // other sites allowed to call this endpoint from a browser (CORS); calls from this same site always are
  'allowed_origins' => [],
  'max_presets' => 200,
  'max_body' => 262144,
];
