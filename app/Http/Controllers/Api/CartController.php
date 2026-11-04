<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CartItemsRules;
use App\Services\CartQuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Cart
 *
 * The cart lives on the client. This endpoint prices it; it never trusts client prices.
 */
class CartController extends Controller
{
    /**
     * Quote a cart
     *
     * Public (guests can price a cart). With a Bearer token, per-customer coupon limits are checked too.
     * Line errors: `not_found`, `inactive`, `out_of_stock`, `invalid_size`, `combo_unavailable`.
     *
     * @unauthenticated
     *
     * @bodyParam items object[] required Cart lines.
     * @bodyParam items[].type string required product or custom_ring. Example: product
     * @bodyParam items[].product_id integer For products. Example: 1
     * @bodyParam items[].ring_id integer For custom rings. Example: 1
     * @bodyParam items[].stone_id integer For custom rings. Example: 1
     * @bodyParam items[].size string Required for sized products and custom rings. Example: 7
     * @bodyParam items[].qty integer required Example: 1
     * @bodyParam coupon_code string Example: AANI10
     * @bodyParam shipping_method string standard, express or overnight. Example: standard
     */
    public function quote(Request $request, CartQuoteService $quotes): JsonResponse
    {
        $data = $request->validate(CartItemsRules::rules(allowEmpty: true) + [
            'coupon_code' => ['nullable', 'string', 'max:40'],
            'shipping_method' => ['nullable', 'string', 'max:40'],
        ], CartItemsRules::messages());

        $user = $request->user('sanctum');
        $quote = $quotes->quote($data['items'] ?? [], $data['coupon_code'] ?? null, $data['shipping_method'] ?? null, $user);

        return response()->json(['data' => $quotes->present($quote)]);
    }
}
