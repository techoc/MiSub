export function base64Encode(str: any) {
    return btoa(unescape(encodeURIComponent(str)));
}
