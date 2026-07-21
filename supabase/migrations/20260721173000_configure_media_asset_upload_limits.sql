update storage.buckets
set
    public = true,
    file_size_limit = 524288000,
    allowed_mime_types = array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'video/quicktime'
    ]
where id = 'media-assets';
