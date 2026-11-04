# Authenticating requests

To authenticate requests, include an **`Authorization`** header with the value **`"Bearer {YOUR_TOKEN}"`**.

All authenticated endpoints are marked with a `requires authentication` badge in the documentation below.

Get a customer token from <code>POST /auth/login</code>, <code>/auth/register</code> or <code>/auth/google</code> and send it as <code>Authorization: Bearer &lt;token&gt;</code>.
