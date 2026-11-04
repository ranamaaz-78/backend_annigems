<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** @group Admin: Media */
class MediaController extends Controller
{
    /** Upload an image to the public disk. Returns the stored path and URL. */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif,svg', 'max:8192'],
            'folder' => ['nullable', 'alpha_dash', 'max:40'],
        ]);
        $folder = 'uploads/'.($request->input('folder') ?: 'misc').'/'.now()->format('Y/m');
        $file = $request->file('file');
        $name = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'image';
        $path = $file->storeAs($folder, $name.'-'.Str::lower(Str::random(6)).'.'.$file->extension(), 'public');

        return response()->json(['data' => ['path' => $path, 'url' => Media::url($path)]], 201);
    }
}
