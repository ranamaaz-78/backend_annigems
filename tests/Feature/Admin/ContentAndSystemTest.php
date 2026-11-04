<?php

namespace Tests\Feature\Admin;

use App\Mail\ContactReplyMail;
use App\Models\AdminUser;
use App\Models\ContactMessage;
use App\Models\Faq;
use App\Models\FaqCategory;
use App\Models\NewsletterSubscriber;
use App\Models\Page;
use Illuminate\Support\Facades\Mail;
use Spatie\Activitylog\Models\Activity;

class ContentAndSystemTest extends AdminTestCase
{
    public function test_content_blocks(): void
    {
        $this->actingAsStaff('Manager');
        $this->admin('GET', 'content/blocks')->assertOk()->assertJsonCount(25, 'data');
        $hero = $this->admin('GET', 'content/blocks/home.hero')->assertOk()->json('data.value');
        $hero['titleLine1'] = 'Where Gold Shines';
        $hero['image'] = 'http://localhost/storage/uploads/misc/hero.jpg';
        $this->admin('PUT', 'content/blocks/home.hero', ['value' => $hero])->assertOk()->assertJsonPath('data.value.image', 'uploads/misc/hero.jpg');
        $this->api('GET', 'home')->assertJsonPath('data.hero.titleLine1', 'Where Gold Shines');

        $this->admin('PUT', 'content/blocks/payment_badges', ['value' => ['a' => 1]])->assertStatus(422);
        $this->admin('PUT', 'content/blocks/nope', ['value' => []])->assertNotFound();
        $this->admin('PUT', 'content/blocks/contact.topics', ['value' => ['Orders', 'Other']])->assertOk();
        $this->api('POST', 'contact', ['name' => 'A', 'email' => 'a@b.co', 'topic' => 'Orders', 'message' => 'Hello there'])->assertCreated();
        $this->assertTrue(Activity::where('log_name', 'content')->exists());
    }

    public function test_pages_faqs_testimonials(): void
    {
        $this->actingAsStaff('Manager');
        $page = Page::where('slug', 'returns')->first();
        $this->admin('PUT', "content/pages/{$page->id}", [
            'slug' => 'returns', 'title' => 'Returns', 'is_active' => true,
            'sections' => [['heading' => 'New window', 'body' => ['First paragraph', '']]],
        ])->assertOk()->assertJsonPath('data.sections.0.id', 'new-window')->assertJsonPath('data.sections.0.body', ['First paragraph']);
        $this->api('GET', 'pages/returns')->assertJsonPath('data.sections.0.heading', 'New window');

        $cat = FaqCategory::first();
        $this->admin('POST', 'content/faqs', ['category_id' => $cat->id, 'question' => 'Q?', 'answer' => 'A.', 'is_active' => true])->assertOk();
        $ids = Faq::where('category_id', $cat->id)->orderBy('sort_order')->pluck('id')->reverse()->values()->all();
        $this->admin('POST', 'content/faqs/reorder', ['items' => [$cat->id => $ids]])->assertOk();
        $this->api('GET', 'faqs')->assertJsonPath('data.0.items.0.q', 'Q?');

        $this->admin('POST', 'content/testimonials', ['name' => 'Ana Lopez', 'rating' => 5, 'text' => 'Wonderful', 'is_active' => true])->assertCreated()->assertJsonPath('data.initials', 'AL');
        $this->admin('PUT', 'configurator/size-guide/configurator.size_guide_steps', ['value' => ['One', 'Two']])->assertOk();
        $this->api('GET', 'configurator')->assertJsonPath('data.size_guide_steps', ['One', 'Two']);
    }

    public function test_messages_and_newsletter(): void
    {
        Mail::fake();
        $this->actingAsStaff('Support');
        $m = ContactMessage::create(['name' => 'Gia', 'email' => 'gia@example.com', 'topic' => 'Other', 'message' => 'Hi']);
        $this->admin('GET', 'messages?status=new')->assertOk()->assertJsonPath('meta.total', 1);
        $this->admin('GET', "messages/{$m->id}")->assertOk()->assertJsonPath('data.status', 'read');
        $this->admin('POST', "messages/{$m->id}/reply", ['body' => 'Thank you!'])->assertOk()->assertJsonPath('data.status', 'replied');
        Mail::assertQueued(ContactReplyMail::class);

        NewsletterSubscriber::create(['email' => 'n@example.com', 'subscribed_at' => now()]);
        $this->admin('GET', 'newsletter')->assertOk()->assertJsonPath('active_total', 1);
        $this->assertStringContainsString('n@example.com', $this->get('/api/v1/admin/newsletter-export')->streamedContent());
        $this->admin('GET', 'content/blocks')->assertForbidden();
        $this->admin('GET', 'staff')->assertForbidden();
    }

    public function test_staff_roles_activity_settings(): void
    {
        Mail::fake();
        $me = $this->actingAsStaff('Super Admin');
        $res = $this->admin('POST', 'staff', ['name' => 'Sam', 'email' => 'sam@aanigems.com', 'roles' => ['Support']])->assertCreated();
        $id = $res->json('data.id');
        $this->admin('PUT', "staff/{$id}", ['name' => 'Sam', 'email' => 'sam@aanigems.com', 'roles' => ['Manager'], 'is_active' => true])->assertOk()->assertJsonPath('data.roles', ['Manager']);
        AdminUser::find($id)->forceFill(['two_factor_secret' => 'X', 'two_factor_confirmed_at' => now()])->save();
        $this->admin('POST', "staff/{$id}/reset-2fa")->assertOk()->assertJsonPath('data.two_factor_enabled', false);
        // The last active Super Admin cannot be demoted or deleted.
        AdminUser::where('email', 'admin@aanigems.com')->update(['is_active' => false]);
        $this->admin('PUT', "staff/{$me->id}", ['name' => 'Me', 'email' => $me->email, 'roles' => ['Manager'], 'is_active' => true])->assertStatus(422);
        $this->admin('DELETE', "staff/{$me->id}")->assertStatus(422);

        $roles = $this->admin('GET', 'roles')->assertOk()->json('data.roles');
        $support = collect($roles)->firstWhere('name', 'Support');
        $this->admin('PUT', "roles/{$support['id']}", ['permissions' => ['orders.view']])->assertOk();
        $super = collect($roles)->firstWhere('name', 'Super Admin');
        $this->admin('PUT', "roles/{$super['id']}", ['permissions' => []])->assertStatus(422);

        $this->admin('GET', 'activity?log_name=staff')->assertOk()->assertJsonPath('data.0.causer', $me->name);

        $settings = $this->admin('GET', 'settings')->assertOk()->json('data');
        $settings['maintenance'] = ['enabled' => true, 'message' => 'Back soon'];
        $settings['mobile']['ios']['force_update'] = true;
        $this->admin('PUT', 'settings', $settings)->assertOk();
        $this->api('GET', 'bootstrap', platform: 'mobile')->assertJsonPath('data.app.maintenance.enabled', true)->assertJsonPath('data.app.ios.force_update', true);
        $settings['mobile']['ios']['min_version'] = 'v1';
        $this->admin('PUT', 'settings', $settings)->assertStatus(422);
    }

    public function test_manager_cannot_manage_staff_or_settings(): void
    {
        $this->actingAsStaff('Manager');
        $this->admin('GET', 'staff')->assertForbidden();
        $this->admin('GET', 'roles')->assertForbidden();
        $this->admin('GET', 'settings')->assertForbidden();
        $this->admin('GET', 'activity')->assertForbidden();
        $this->admin('GET', 'messages')->assertOk();
    }
}
