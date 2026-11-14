/**
 * 现代协议（hysteria2 / tuic / wireguard / snell / anytls）URL → Clash 代理解析
 * 从 url-to-clash.js 拆分而来；调度器见 ../url-to-clash.js。
 */

import { extractName, parseHostPort, parseQueryParams } from './parse-shared.ts';

export function parseHysteria2Url(url: unknown): Record<string, unknown> | null {
    try {
        const urlText = String(url || '');
        // hysteria2://password@server:port?params#name
        // hy2://password@server:port?params#name
        const prefixLen = urlText.startsWith('hysteria2://') ? 12 : 6;
        const body = urlText.substring(prefixLen);

        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let password = body.substring(0, atIndex);
        try {
            password = decodeURIComponent(password);
        } catch {}

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(urlText);
        const name = extractName(urlText);

        const proxy: Record<string, unknown> = {
            name: name || `Hysteria2-${server}`,
            type: 'hysteria2',
            server,
            port,
            password,
            // Stash 使用 auth 字段而非 password，同时输出双字段以兼容 Stash/Clash Meta
            auth: password,
        };

        // SNI（兼容 Shadowrocket 的 peer 参数）
        const sniParam = params.get('sni') || params.get('peer');
        if (sniParam) {
            proxy.servername = sniParam;
            proxy.sni = sniParam;
        }

        // Skip cert verify
        if (params.get('insecure') === '1' || params.get('allowInsecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        // [Hysteria2] handshake timeout
        const handshakeTimeout = params.get('handshake-timeout');
        if (handshakeTimeout) {
            proxy['handshake-timeout'] = parseInt(handshakeTimeout, 10);
        }

        // 证书指纹固定（兼容 pinSHA256 / hpkp / fingerprint），自签证书场景必需
        const pinParam = params.get('pinSHA256') || params.get('hpkp') || params.get('fingerprint');
        if (pinParam) proxy.fingerprint = pinParam;

        // Obfs
        if (params.get('obfs')) {
            proxy.obfs = params.get('obfs');
            if (params.get('obfs-password')) {
                proxy['obfs-password'] = params.get('obfs-password');
            }
        }

        if (params.get('ports') || params.get('mport')) {
            proxy.ports = params.get('ports') || params.get('mport');
        }
        if (params.get('hop-interval')) proxy['hop-interval'] = params.get('hop-interval');
        if (params.get('up')) proxy.up = params.get('up');
        if (params.get('down')) proxy.down = params.get('down');
        // 兼容 Shadowrocket / v2rayN 的 upmbps / downmbps
        if (!proxy.up && params.get('upmbps')) proxy.up = `${params.get('upmbps')} Mbps`;
        if (!proxy.down && params.get('downmbps')) proxy.down = `${params.get('downmbps')} Mbps`;
        const fastOpen = params.get('fast_open') || params.get('fast-open');
        if (fastOpen === '1' || fastOpen === 'true') {
            proxy['fast-open'] = true;
        } else if (fastOpen === '0' || fastOpen === 'false') {
            proxy['fast-open'] = false;
        }

        const realmId = params.get('realm-id');
        const realmToken = params.get('realm-token') || params.get('token');
        const realmServerUrl = params.get('realm-server') || params.get('server-url');
        const stunServers = params.get('stun-servers');
        if (realmId || realmToken || realmServerUrl || stunServers) {
            const realmOpts: Record<string, unknown> = { enable: true };
            if (realmId) realmOpts['realm-id'] = realmId;
            if (realmToken) realmOpts.token = realmToken;
            if (realmServerUrl) realmOpts['server-url'] = realmServerUrl;
            if (stunServers) {
                realmOpts['stun-servers'] = stunServers
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
            proxy['realm-opts'] = realmOpts;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        return proxy;
    } catch (e) {
        console.error('解析 Hysteria2 URL 失败:', e);
        return null;
    }
}

/**
 * 将 TUIC URL 转换为 Clash 代理对象
 * @param {string} url - TUIC URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseTuicUrl(url: unknown): Record<string, unknown> | null {
    try {
        const urlText = String(url || '');
        // tuic://token@server:port?sni=xxx&alpn=xxx#name
        const body = urlText.substring(7); // 去掉 tuic://

        const atIndex = body.lastIndexOf('@');
        if (atIndex === -1) return null;

        const token = body.substring(0, atIndex);
        const separatorIndex = token.indexOf(':');
        const rawUuid = separatorIndex === -1 ? token : token.substring(0, separatorIndex);
        const rawPassword = separatorIndex === -1 ? '' : token.substring(separatorIndex + 1);

        const safeDecode = (value: string): string => {
            try {
                return decodeURIComponent(value);
            } catch {
                return value;
            }
        };

        const uuid = safeDecode(rawUuid);
        const password = safeDecode(rawPassword);

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(urlText);
        const name = extractName(urlText);

        const proxy: Record<string, unknown> = {
            name: name || `TUIC-${server}`,
            type: 'tuic',
            server,
            port,
            uuid,
            password,
        };

        // SNI
        const sni = params.get('sni');
        if (sni) {
            proxy.servername = sni;
            proxy.sni = sni;
        }

        // ALPN
        if (params.get('alpn')) {
            proxy.alpn = params.get('alpn')!.split(',');
        }

        // Skip cert verify
        if (
            params.get('allowInsecure') === '1' ||
            params.get('insecure') === '1' ||
            params.get('allow_insecure') === '1'
        ) {
            proxy['skip-cert-verify'] = true;
        }

        // 拥塞控制
        const congestionControl =
            params.get('congestion_control') ||
            params.get('congestion-control') ||
            params.get('congestion-controller');
        if (congestionControl) {
            proxy['congestion-controller'] = congestionControl;
        }

        // UDP Relay Mode
        const udpRelayMode = params.get('udp_relay_mode') || params.get('udp-relay-mode');
        if (udpRelayMode) {
            proxy['udp-relay-mode'] = udpRelayMode;
        }

        // sing-box extension: UDP over stream. Conflicts with udp-relay-mode in sing-box,
        // but preserve both input fields so target renderers can decide how to emit them.
        const udpOverStream = params.get('udp_over_stream') || params.get('udp-over-stream');
        if (udpOverStream === '1' || udpOverStream === 'true') {
            proxy['udp-over-stream'] = true;
        } else if (udpOverStream === '0' || udpOverStream === 'false') {
            proxy['udp-over-stream'] = false;
        }

        const zeroRttHandshake =
            params.get('zero_rtt_handshake') ||
            params.get('zero-rtt-handshake') ||
            params.get('reduce_rtt') ||
            params.get('reduce-rtt');
        if (zeroRttHandshake === '1' || zeroRttHandshake === 'true') {
            proxy['zero-rtt-handshake'] = true;
            proxy['reduce-rtt'] = true;
        } else if (zeroRttHandshake === '0' || zeroRttHandshake === 'false') {
            proxy['zero-rtt-handshake'] = false;
            proxy['reduce-rtt'] = false;
        }

        if (params.get('heartbeat')) {
            proxy.heartbeat = params.get('heartbeat');
        }
        if (params.get('heartbeat_interval') || params.get('heartbeat-interval')) {
            proxy['heartbeat-interval'] =
                params.get('heartbeat_interval') || params.get('heartbeat-interval');
        }
        if (params.get('request_timeout') || params.get('request-timeout')) {
            proxy['request-timeout'] = Number(
                params.get('request_timeout') || params.get('request-timeout')
            );
        }
        if (params.get('cwnd')) {
            proxy.cwnd = Number(params.get('cwnd'));
        }
        if (params.get('bbr_profile') || params.get('bbr-profile')) {
            proxy['bbr-profile'] = params.get('bbr_profile') || params.get('bbr-profile');
        }
        if (params.get('max_udp_relay_packet_size') || params.get('max-udp-relay-packet-size')) {
            proxy['max-udp-relay-packet-size'] = Number(
                params.get('max_udp_relay_packet_size') || params.get('max-udp-relay-packet-size')
            );
        }
        if (params.get('max_open_streams') || params.get('max-open-streams')) {
            proxy['max-open-streams'] = Number(
                params.get('max_open_streams') || params.get('max-open-streams')
            );
        }

        const disableSni = params.get('disable_sni') || params.get('disable-sni');
        if (disableSni === '1' || disableSni === 'true') {
            proxy['disable-sni'] = true;
        } else if (disableSni === '0' || disableSni === 'false') {
            proxy['disable-sni'] = false;
        }

        const fastOpen = params.get('fast_open') || params.get('fast-open');
        if (fastOpen === '1' || fastOpen === 'true') {
            proxy['fast-open'] = true;
        } else if (fastOpen === '0' || fastOpen === 'false') {
            proxy['fast-open'] = false;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 TUIC URL 失败:', e);
        return null;
    }
}

/**
 * 将 WireGuard URL 转换为 Clash 代理对象
 * @param {string} url - WireGuard URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseWireguardUrl(url: unknown): Record<string, unknown> | null {
    try {
        const urlText = String(url || '');
        // wireguard://privatekey@server:port?params#name
        const body = urlText.substring('wireguard://'.length);

        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let privateKey = body.substring(0, atIndex);
        try {
            privateKey = decodeURIComponent(privateKey);
        } catch {}

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(urlText);
        const name = extractName(urlText);

        const proxy: Record<string, unknown> = {
            name: name || `WireGuard-${server}`,
            type: 'wireguard',
            server,
            port,
            'private-key': privateKey,
            'remote-dns-resolve': true,
            udp: true,
        };

        // 公钥
        const publicKey = params.get('publickey') || params.get('public-key');
        if (publicKey) {
            proxy['public-key'] = publicKey;
        }

        // 本地地址。保留 WireGuard 的 CIDR 和多地址形状，避免转换往返时丢失
        // 隧道前缀；同时提供 ipv6 兼容字段给需要独立 IPv6 字段的渲染器。
        const address = params.get('address');
        if (address) {
            const addresses = address
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean);

            const ipv6 = addresses.find((a) => a.includes(':'));

            if (addresses.length > 0) proxy.ip = addresses;
            if (ipv6) proxy.ipv6 = ipv6;
        }

        // Allowed IPs
        const allowedIPs = params.get('allowedips') || params.get('allowed-ips');
        if (allowedIPs) {
            proxy['allowed-ips'] = allowedIPs.split(',').map((a) => a.trim());
        }

        // Reserved (Cloudflare WARP)
        const reserved = params.get('reserved');
        if (reserved) {
            const reservedArr = reserved.split(',').map((n) => parseInt(n.trim()));
            if (reservedArr.every((n) => !isNaN(n))) {
                proxy.reserved = reservedArr;
            }
        }

        // MTU
        const mtu = params.get('mtu');
        if (mtu) {
            proxy.mtu = parseInt(mtu);
        }

        // DNS
        const dns = params.get('dns');
        if (dns) {
            proxy.dns = dns.split(',').map((d) => d.trim());
        }

        // Keepalive
        const keepalive = params.get('keepalive');
        if (keepalive) {
            proxy['persistent-keepalive'] = parseInt(keepalive);
        }

        // Preshared Key
        const presharedKey = params.get('presharedkey') || params.get('preshared-key');
        if (presharedKey) {
            proxy['preshared-key'] = presharedKey;
        }

        return proxy;
    } catch (e) {
        console.error('解析 WireGuard URL 失败:', e);
        return null;
    }
}

/**
 * 将 Snell URL 转换为 Clash 代理对象
 * @param {string} url - Snell URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseSnellUrl(url: unknown): Record<string, unknown> | null {
    try {
        const urlText = String(url || '');
        const body = urlText.substring('snell://'.length);
        let psk = '';
        let serverPart = '';
        const atIndex = body.indexOf('@');
        if (atIndex !== -1) {
            psk = body.substring(0, atIndex);
            try {
                psk = decodeURIComponent(psk);
            } catch {}
            serverPart = body.substring(atIndex + 1);
        } else {
            serverPart = body;
        }

        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');
        let hostPortStr = serverPart;
        if (queryIndex !== -1) {
            hostPortStr = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            hostPortStr = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(hostPortStr);
        const params = parseQueryParams(urlText);
        const name = extractName(urlText);

        if (!psk) psk = params.get('psk') || params.get('password') || '';

        const proxy: Record<string, unknown> = {
            name: name || `Snell-${server}`,
            type: 'snell',
            server,
            port,
            psk,
        };
        const version = params.get('version');
        if (version) proxy.version = parseInt(version);
        const reuse = params.get('reuse');
        if (reuse !== null) proxy.reuse = reuse === 'true';
        const tfo = params.get('tfo');
        if (tfo !== null) proxy.tfo = tfo === 'true';
        const obfs = params.get('obfs');
        const obfsHost = params.get('obfs-host');
        if (obfs || obfsHost) {
            const obfsOpts: Record<string, unknown> = {};
            if (obfs) obfsOpts.mode = obfs;
            if (obfsHost) obfsOpts.host = obfsHost;
            proxy['obfs-opts'] = obfsOpts;
        }
        if (params.get('udp-relay') === 'true') proxy.udp = true;
        if (params.get('ecn') === 'true' || params.get('ecn') === '1') proxy.ecn = true;
        return proxy;
    } catch (e) {
        console.error('解析 Snell URL 失败:', e);
        return null;
    }
}

/**
 * 将 AnyTLS URL 转换为 Clash 代理对象
 * @param {string} url - AnyTLS URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseAnytlsUrl(url: unknown): Record<string, unknown> | null {
    try {
        const urlText = String(url || '');
        const body = urlText.substring(9);
        let password = '';
        let serverPart = '';
        const atIndex = body.indexOf('@');
        if (atIndex !== -1) {
            password = body.substring(0, atIndex);
            try {
                password = decodeURIComponent(password);
            } catch {}
            serverPart = body.substring(atIndex + 1);
        } else {
            serverPart = body;
        }

        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');
        let hostPortStr = serverPart;
        if (queryIndex !== -1) {
            hostPortStr = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            hostPortStr = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(hostPortStr);
        const safePort = isNaN(port) ? 443 : port;
        const params = parseQueryParams(urlText);
        const name = extractName(urlText);

        const proxy: Record<string, unknown> = {
            name: name || `AnyTLS-${server}`,
            type: 'anytls',
            server,
            port: safePort,
            password,
        };

        const sni = params.get('sni') || params.get('peer');
        if (sni) {
            proxy.servername = sni;
            proxy.sni = sni;
        }

        if (params.get('alpn')) proxy.alpn = params.get('alpn')!.split(',');
        if (params.get('insecure') === '1' || params.get('allowInsecure') === '1')
            proxy['skip-cert-verify'] = true;
        const pinnedPeerCertSha256 =
            params.get('pinnedPeerCertSha256') ||
            params.get('pinned-peer-cert-sha256') ||
            params.get('peer-cert-sha256') ||
            params.get('certSha256');
        if (pinnedPeerCertSha256) proxy.pinnedPeerCertSha256 = pinnedPeerCertSha256;

        proxy.udp = true;
        return proxy;
    } catch (e) {
        console.error('解析 AnyTLS URL 失败:', e);
        return null;
    }
}

/**
 * 将 HTTPS URL 转换为 Clash 代理对象
 * @param {string} url - HTTPS URL
 * @returns {Object|null} Clash 代理对象
 */
