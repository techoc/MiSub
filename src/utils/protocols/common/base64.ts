export function base64Encode(str: unknown): string {
    return btoa(unescape(encodeURIComponent(String(str))));
}
