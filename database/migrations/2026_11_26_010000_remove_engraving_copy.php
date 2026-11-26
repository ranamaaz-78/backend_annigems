<?php

use App\Models\ContentBlock;
use App\Models\Faq;
use App\Models\Page;
use App\Models\Product;
use Illuminate\Database\Migrations\Migration;

/**
 * Engraving is not offered anywhere in the order flow, so the copy that promised it goes
 * (services card, footer link, product copy, returns policy, FAQ). Same edits as storefront-seed.json.
 * Only exact seeded strings are touched; anything already rewritten in the admin is left alone.
 */
return new class extends Migration
{
    public function up(): void
    {
        $services = ContentBlock::where('key', 'services')->first();
        if ($services && is_array($services->value)) {
            $services->value = array_values(array_filter($services->value, fn ($s) => ($s['title'] ?? '') !== 'Engraving'));
            $services->save();
        }

        $footer = ContentBlock::where('key', 'footer.columns')->first();
        if ($footer && is_array($footer->value)) {
            $footer->value = array_map(function ($col) {
                $col['links'] = array_values(array_filter($col['links'] ?? [], fn ($l) => ($l['label'] ?? '') !== 'Engraving'));

                return $col;
            }, $footer->value);
            $footer->save();
        }

        foreach (Product::withTrashed()->get() as $p) {
            $details = $p->details ?? [];
            $clean = array_values(array_filter($details, fn ($d) => $d !== 'Complimentary engraving'));
            $description = str_replace(' Includes complimentary engraving.', '', (string) $p->description);
            if ($clean !== $details || $description !== $p->description) {
                $p->forceFill(['details' => $clean, 'description' => $description])->save();
            }
        }

        $returns = Page::where('slug', 'returns')->first();
        if ($returns && is_array($returns->sections)) {
            $returns->sections = array_map(function ($s) {
                if (($s['heading'] ?? '') === 'Custom & engraved pieces') {
                    $s['heading'] = 'Custom pieces';
                }
                $s['body'] = array_map(fn ($b) => str_replace('bespoke rings and engraved items cannot', 'bespoke rings cannot', $b), $s['body'] ?? []);

                return $s;
            }, $returns->sections);
            $returns->save();
        }

        Faq::where('answer', 'like', '%Custom and engraved items%')->get()->each(
            fn ($f) => $f->forceFill(['answer' => str_replace('Custom and engraved items are', 'Custom pieces are', $f->answer)])->save()
        );
    }

    public function down(): void
    {
        // Copy-only change; restore from storefront-seed.json history if needed.
    }
};
