/**
 * sing-box 出站配置 → 节点链接 的最小实现。
 *
 * 仅覆盖可无损映射回 URL 的代理类型（vless / vmess / trojan / shadowsocks /
 * hysteria2 / tuic / anytls）。selector / urltest / direct / block / dns 等
 * 非节点出站会被忽略。
 *
 * 返回链接数组；无法识别的出站跳过。
 */

/** sing-box 出站/配置记录 */
type SingboxRecord = Record<string, unknown>;

function toArray(value: unknown): unknown[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function b64url(input: unknown): string {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function tlsParams(outbound: SingboxRecord): Array<[string, unknown]> {
    const tls = (outbound.tls || {}) as SingboxRecord;
    const params: Array<[string, unknown]> = [];
    if (tls.enabled) {
        if (tls.server_name) params.push(['sni', tls.server_name]);
        if (tls.insecure) params.push(['allowInsecure', '1']);
        if (tls.alpn) params.push(['alpn', toArray(tls.alpn).join(',')]);
        const reality = (tls.reality || {}) as SingboxRecord;
        if (reality.enabled) {
            params.push(['security', 'reality']);
            if (reality.public_key) params.push(['pbk', reality.public_key]);
            if (reality.short_id) params.push(['sid', reality.short_id]);
        } else {
            params.push(['security', 'tls']);
        }
    }
    if (outbound.flow) params.push(['flow', outbound.flow]);
    const transport = (outbound.transport || {}) as SingboxRecord;
    if (transport.type && transport.type !== 'tcp') {
        params.push(['type', transport.type]);
        if (transport.path) params.push(['path', transport.path]);
        if (transport.host) params.push(['host', transport.host]);
        if (transport.service_name) params.push(['serviceName', transport.service_name]);
    }
    return params;
}

function buildQuery(params: Array<[string, unknown]>): string {
    const search = new URLSearchParams();
    for (const [key, value] of params) {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

/**
 * @param {object} ob sing-box outbound 对象
 * @returns {string|null} 节点链接，或 null（不支持）
 */
export function singboxOutboundToUrl(ob: unknown): string | null {
    if (!ob || typeof ob !== 'object') return null;
    const record = ob as SingboxRecord;
    const type = String(record.type || '').toLowerCase();
    const server = record.server;
    const port = record.server_port ?? record.port;
    const name = String(record.tag || '');
    if (!server || !port) return null;

    const hash = name ? `#${encodeURIComponent(name)}` : '';

    switch (type) {
        case 'vless': {
            const params = tlsParams(record);
            if (record.encryption) params.push(['encryption', record.encryption]);
            else params.push(['encryption', 'none']);
            return `vless://${record.uuid}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'vmess': {
            const transport = (record.transport || {}) as SingboxRecord;
            const tls = (record.tls || {}) as SingboxRecord;
            const obj = {
                v: '2',
                ps: name,
                add: server,
                port: String(port),
                id: record.uuid,
                aid: String(record.alter_id ?? 0),
                scy: record.security || 'auto',
                net: transport.type || 'tcp',
                type: 'none',
                host: transport.host || '',
                path: transport.path || '',
                tls: tls.enabled ? 'tls' : '',
                sni: tls.server_name || '',
            };
            return `vmess://${b64url(JSON.stringify(obj))}`;
        }
        case 'trojan': {
            const params = tlsParams(record);
            return `trojan://${encodeURIComponent(String(record.password || ''))}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'shadowsocks': {
            const method = record.method || 'aes-256-gcm';
            const pwd = record.password || '';
            const userinfo = btoa(unescape(encodeURIComponent(`${method}:${pwd}`))).replace(
                /=+$/,
                ''
            );
            return `ss://${userinfo}@${server}:${port}${hash}`;
        }
        case 'hysteria2':
        case 'hy2': {
            const params = tlsParams(record);
            const obfs = (record.obfs || {}) as SingboxRecord;
            if (obfs.type) {
                params.push(['obfs', obfs.type]);
                if (obfs.password) params.push(['obfs-password', obfs.password]);
            }
            return `hysteria2://${encodeURIComponent(String(record.password || ''))}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'tuic': {
            const params = tlsParams(record);
            if (record.congestion_control)
                params.push(['congestion_control', record.congestion_control]);
            const auth = `${record.uuid || ''}:${record.password || ''}`;
            return `tuic://${auth}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        case 'anytls': {
            const params = tlsParams(record);
            return `anytls://${encodeURIComponent(String(record.password || ''))}@${server}:${port}${buildQuery(params)}${hash}`;
        }
        default:
            return null;
    }
}

/**
 * 从 sing-box 配置对象中提取节点链接。
 * @param {object} config 解析后的 sing-box 配置
 * @returns {string[]}
 */
export function extractSingboxNodes(config: unknown): string[] {
    if (!config || typeof config !== 'object') return [];
    const outbounds = toArray((config as SingboxRecord).outbounds);
    return outbounds
        .map(singboxOutboundToUrl)
        .filter((url): url is string => typeof url === 'string');
}
