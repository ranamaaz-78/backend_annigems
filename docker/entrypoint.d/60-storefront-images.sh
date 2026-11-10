#!/bin/sh
# Copies the storefront seed images (logo, banners, products) into the public disk when they are missing.
# storage/app/public is not in git, so a fresh container (or an empty volume) would otherwise serve 404s
# for /storage/images/*. Existing files (e.g. replaced from the admin) are never overwritten.
set -e

src=/var/www/html/database/seeders/data/images
dest=/var/www/html/storage/app/public/images

[ -d "$src" ] || exit 0
mkdir -p "$dest"
for f in "$src"/*; do
  [ -f "$f" ] || continue
  [ -e "$dest/$(basename "$f")" ] || cp "$f" "$dest/"
done
echo "storefront images: ready in $dest"
