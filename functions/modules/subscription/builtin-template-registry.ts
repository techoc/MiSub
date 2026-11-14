export const BUILTIN_TEMPLATE_REGISTRY = {
    clash_misub_minimal: {
        id: 'clash_misub_minimal',
        name: 'MiSub 极简默认分流',
        target: 'clash',
        format: 'ini',
        description:
            '更偏日常使用的极简模板，仅保留主选择、自动选择、常用媒体与兜底分组，适合作为统一模板主线默认配置。',
        content: `[custom]
ruleset=🎬 流媒体,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🔯 故障转移\`[]<%regionStrategyChain%>\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🔯 故障转移\`fallback\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=🎬 流媒体\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_acl4ssr_lite: {
        id: 'clash_acl4ssr_lite',
        name: 'ACL4SSR 精简分流',
        target: 'clash',
        format: 'ini',
        description: '内置精简 ACL4SSR 分流模板，保留常用分组和核心规则，适合作为轻量默认预设。',
        content: `[custom]
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list
ruleset=🛑 广告拦截,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]<%regionStrategyChain%>\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`[]<%regionStrategyChain%>\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🛑 广告拦截\`select\`[]REJECT\`[]DIRECT
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🇭🇰 香港节点\`url-test\`(港|HK|Hong Kong|HKG)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(日本|JP|Japan|Tokyo|NRT|KIX)\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(美|US|United States|LAX|SJC|SEA)\`http://www.gstatic.com/generate_204\`300,,100

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_misub_media_ai: {
        id: 'clash_misub_media_ai',
        name: 'MiSub 流媒体与 AI 分流',
        target: 'clash',
        format: 'ini',
        description: '面向常见流媒体和 AI 服务场景的内置模板，保留自动选择、地区组和核心服务分流。',
        content: `[custom]
ruleset=🤖 AI 服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list
ruleset=🤖 AI 服务,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/538b8a79532c44dfbcb8e694d2f43e753c60b157/rule/Clash/Claude/Claude.list
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,x.ai
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,xai.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,grok.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,gemini.google.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,aistudio.google.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,copilot.microsoft.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,api.githubcopilot.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,perplexity.ai
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,poe.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,character.ai
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,deepseek.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,moonshot.cn
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,yuanbao.tencent.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,tongyi.aliyun.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,qianwen.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,doubao.com
ruleset=🤖 AI 服务,[]DOMAIN-SUFFIX,coze.cn
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaDomain.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]<%regionStrategyChain%>\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=♻️ 自动选择\`url-test\`[]<%regionStrategyChain%>\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=🤖 AI 服务\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`[]🚀 节点选择
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_acl4ssr_full: {
        id: 'clash_acl4ssr_full',
        name: 'ACL4SSR 完整分流',
        target: 'clash',
        format: 'ini',
        description: '内置完整 ACL4SSR 分流模板，适合作为 Clash 系列的高完整度规则预设。',
        content: `[custom]
ruleset=🎯 全球直连,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/LocalAreaNetwork.list
ruleset=🛑 广告拦截,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list
ruleset=📲 电报消息,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Telegram.list
ruleset=🤖 AI 服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list
ruleset=📹 油管视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/YouTube.list
ruleset=🎥 奈飞视频,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Steam.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🔯 故障转移\`[]<%regionStrategyChain%>\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🔯 故障转移\`fallback\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🤖 AI 服务\`select\`[]🚀 节点选择\`[]🔯 故障转移\`[]🇺🇸 美国节点\`[]🌍 狮城节点
custom_proxy_group=📲 电报消息\`select\`[]🚀 节点选择\`[]🇸🇬 狮城节点\`[]🇭🇰 香港节点
custom_proxy_group=📹 油管视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择
custom_proxy_group=🎥 奈飞视频\`select\`[]🚀 节点选择\`[]♻️ 自动选择
custom_proxy_group=🎮 游戏平台\`select\`[]🚀 节点选择\`[]DIRECT
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT
custom_proxy_group=🛑 广告拦截\`select\`[]REJECT\`[]DIRECT
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 节点选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_exclusive_ai: {
        id: 'clash_exclusive_ai',
        name: 'MiSub 深度 AI 开发者模板',
        target: 'clash',
        format: 'ini',
        description:
            '专为 AI 开发者优化，强化 OpenAI/Claude 路由，增加固定节点漂移保护与纯净度检测引导。',
        content: `[custom]
ruleset=🤖 AI 核心服务,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAi.list
ruleset=🤖 AI 核心服务,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/538b8a79532c44dfbcb8e694d2f43e753c60b157/rule/Clash/Claude/Claude.list
ruleset=🌍 国外媒体,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🔯 故障转移\`[]🇺🇲 美国节点\`[]🇸🇬 狮城节点\`[]☑️ 手动切换\`[]DIRECT
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🔯 故障转移\`fallback\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*
custom_proxy_group=🤖 AI 核心服务\`select\`[]🔯 故障转移\`[]🇺🇲 美国节点\`[]🇸🇬 狮城节点\`[]🚀 节点选择
custom_proxy_group=🌍 国外媒体\`select\`[]🚀 节点选择\`[]♻️ 自动选择\`[]DIRECT

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_game_optimized: {
        id: 'clash_game_optimized',
        name: 'MiSub 游戏加速竞技模板',
        target: 'clash',
        format: 'ini',
        description: '强化各平台游戏规则（Steam, Epic, Sony 等），优先选择低延迟线路。',
        content: `[custom]
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Steam.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Epic.list
ruleset=🎮 游戏平台,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Sony.list
ruleset=🚀 节点选择,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list
ruleset=🎯 全球直连,[]GEOIP,CN
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 节点选择\`select\`[]♻️ 自动选择\`[]🎮 游戏平台\`[]☑️ 手动切换
custom_proxy_group=🎮 游戏平台\`url-test\`.*\`http://www.gstatic.com/generate_204\`300,,20
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`http://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=☑️ 手动切换\`select\`.*

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_standard: {
        id: 'clash_aethersailor_standard',
        name: 'Aethersailor 标准版',
        target: 'clash',
        format: 'ini',
        description:
            '全分组防 DNS 泄漏标准模板：GEOSITE 规则 + 六地区策略组，分类细致，适配 mihomo/Clash.Meta 内核。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 手动选择,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 手动选择,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Domain.mrs,28800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-game-platforms-download
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=💬 即时通讯,[]GEOSITE,category-communication
ruleset=🌐 社交媒体,[]GEOSITE,category-social-media-!cn
ruleset=🤖 ChatGPT,[]GEOSITE,openai
ruleset=🤖 AI服务,[]GEOSITE,category-ai-!cn
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=📹 YouTube,[]GEOSITE,youtube
ruleset=🎥 AppleTV+,[]GEOSITE,apple-tvplus
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🎶 TikTok,[]GEOSITE,tiktok
ruleset=🎥 Netflix,[]GEOSITE,netflix
ruleset=🎥 DisneyPlus,[]GEOSITE,disney
ruleset=🎥 HBO,[]GEOSITE,hbo
ruleset=🎥 PrimeVideo,[]GEOSITE,primevideo
ruleset=🎥 Emby,[]GEOSITE,category-emby
ruleset=🎻 Spotify,[]GEOSITE,spotify
ruleset=📺 Bahamut,[]GEOSITE,bahamut
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=🌎 国外媒体,[]GEOSITE,category-entertainment
ruleset=🛒 国外电商,[]GEOSITE,category-ecommerce
ruleset=🚀 手动选择,[]GEOSITE,gfw
ruleset=💬 即时通讯,[]GEOIP,telegram,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,twitter,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,facebook,no-resolve
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎥 Netflix,[]GEOIP,netflix,no-resolve
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 手动选择\`select\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=💬 即时通讯\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🎯 全球直连
custom_proxy_group=🌐 社交媒体\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🎯 全球直连\`.*
custom_proxy_group=🚀 GitHub\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🎯 全球直连
custom_proxy_group=🤖 ChatGPT\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🤖 AI服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎶 TikTok\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=📹 YouTube\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎥 Netflix\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎥 DisneyPlus\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎥 HBO\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎥 PrimeVideo\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎥 AppleTV+\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🎯 全球直连\`.*
custom_proxy_group=🎥 Emby\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎻 Spotify\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=📺 Bahamut\`select\`[]🇼🇸 台湾节点\`[]🇭🇰 香港节点\`[]🚀 手动选择\`[]🎯 全球直连\`.*
custom_proxy_group=🌎 国外媒体\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🛒 国外电商\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=📢 谷歌FCM\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点
custom_proxy_group=🇬 谷歌服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_standard_fallback: {
        id: 'clash_aethersailor_standard_fallback',
        name: 'Aethersailor 标准版（故障转移）',
        target: 'clash',
        format: 'ini',
        description: '标准模板的故障转移版：规则一致，主选择组改为 fallback，代理异常时自动切换。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 故障转移,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 故障转移,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Domain.mrs,28800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-game-platforms-download
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=💬 即时通讯,[]GEOSITE,category-communication
ruleset=🌐 社交媒体,[]GEOSITE,category-social-media-!cn
ruleset=🤖 ChatGPT,[]GEOSITE,openai
ruleset=🤖 AI服务,[]GEOSITE,category-ai-!cn
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=📹 YouTube,[]GEOSITE,youtube
ruleset=🎥 AppleTV+,[]GEOSITE,apple-tvplus
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🎶 TikTok,[]GEOSITE,tiktok
ruleset=🎥 Netflix,[]GEOSITE,netflix
ruleset=🎥 DisneyPlus,[]GEOSITE,disney
ruleset=🎥 HBO,[]GEOSITE,hbo
ruleset=🎥 PrimeVideo,[]GEOSITE,primevideo
ruleset=🎥 Emby,[]GEOSITE,category-emby
ruleset=🎻 Spotify,[]GEOSITE,spotify
ruleset=📺 Bahamut,[]GEOSITE,bahamut
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=🌎 国外媒体,[]GEOSITE,category-entertainment
ruleset=🛒 国外电商,[]GEOSITE,category-ecommerce
ruleset=🚀 故障转移,[]GEOSITE,gfw
ruleset=💬 即时通讯,[]GEOIP,telegram,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,twitter,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,facebook,no-resolve
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎥 Netflix,[]GEOIP,netflix,no-resolve
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 故障转移\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=💬 即时通讯\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🌐 社交媒体\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🚀 GitHub\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 ChatGPT\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 AI服务\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎶 TikTok\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📹 YouTube\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 Netflix\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 DisneyPlus\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 HBO\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 PrimeVideo\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 AppleTV+\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 Emby\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎻 Spotify\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📺 Bahamut\`fallback\`[]🇼🇸 台湾节点\`[]🇭🇰 香港节点\`[]🚀 故障转移\`[]🎯 全球直连\`^(?!.*(?:🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🌎 国外媒体\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🛒 国外电商\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📢 谷歌FCM\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`[]🎯 全球直连\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🇬 谷歌服务\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🐟 漏网之鱼\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_lite: {
        id: 'clash_aethersailor_lite',
        name: 'Aethersailor 轻量版',
        target: 'clash',
        format: 'ini',
        description: '轻量版模板：仅保留基本分流与直连规则，适合不需要解锁和轻度分流需求的用户。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 手动选择,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 手动选择,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Game_Download_CDN_Domain.mrs,28800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Game_Download_CDN_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🚀 手动选择,[]GEOSITE,gfw
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 手动选择\`select\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🚀 GitHub\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=📢 谷歌FCM\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点
custom_proxy_group=🇬 谷歌服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🐟 漏网之鱼\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`.*
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_lite_fallback: {
        id: 'clash_aethersailor_lite_fallback',
        name: 'Aethersailor 轻量版（故障转移）',
        target: 'clash',
        format: 'ini',
        description: '轻量版模板的故障转移版：规则一致，主选择组改为 fallback。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 故障转移,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 故障转移,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Game_Download_CDN_Domain.mrs,28800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Game_Download_CDN_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🚀 故障转移,[]GEOSITE,gfw
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 故障转移\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🚀 GitHub\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`[]🎯 全球直连\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📢 谷歌FCM\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🇬 谷歌服务\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$
custom_proxy_group=🐟 漏网之鱼\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]♻️ 自动选择\`^(?!.*(?:🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌|🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI|🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)).*$\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_gfw: {
        id: 'clash_aethersailor_gfw',
        name: 'Aethersailor 极简 GFW 版',
        target: 'clash',
        format: 'ini',
        description: '极简 GFW 模板：仅 GFW 列表与境外 IP 走代理、其余直连，最精简、开销最小。',
        content: `[custom]
ruleset=🚀 手动选择,[]GEOSITE,gfw
ruleset=🚀 手动选择,[]GEOIP,telegram,no-resolve
ruleset=🚀 手动选择,[]GEOIP,facebook,no-resolve
ruleset=🚀 手动选择,[]GEOIP,twitter,no-resolve
ruleset=🎯 全球直连,[]FINAL

custom_proxy_group=🚀 手动选择\`select\`[]♻️ 自动选择\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_gfw_fallback: {
        id: 'clash_aethersailor_gfw_fallback',
        name: 'Aethersailor 极简 GFW 版（故障转移）',
        target: 'clash',
        format: 'ini',
        description: '极简 GFW 模板的故障转移版：全部节点组成 fallback 组，自动切换。',
        content: `[custom]
ruleset=🚀 故障转移,[]GEOSITE,gfw
ruleset=🚀 故障转移,[]GEOIP,telegram,no-resolve
ruleset=🚀 故障转移,[]GEOIP,facebook,no-resolve
ruleset=🚀 故障转移,[]GEOIP,twitter,no-resolve
ruleset=🎯 全球直连,[]FINAL

custom_proxy_group=🚀 故障转移\`fallback\`.*\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_full: {
        id: 'clash_aethersailor_full',
        name: 'Aethersailor 重度分流版',
        target: 'clash',
        format: 'ini',
        description: '重度分流模板：Telegram/Zoom/电商/流媒体等分类最全，分组最多，规则最细。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 手动选择,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 手动选择,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Classical.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-game-platforms-download
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=📹 Zoom,[]GEOSITE,zoom
ruleset=📞 Talkatone,[]GEOSITE,talkatone
ruleset=📨 Telegram,[]GEOSITE,telegram
ruleset=🎧 Discord,[]GEOSITE,discord
ruleset=💬 即时通讯,[]GEOSITE,category-communication
ruleset=🤖 Grok,[]GEOSITE,xai
ruleset=🌐 社交媒体,[]GEOSITE,category-social-media-!cn
ruleset=🤖 ChatGPT,[]GEOSITE,openai
ruleset=💾 OneDrive,[]GEOSITE,onedrive
ruleset=🤖 Copilot,[]GEOSITE,bing
ruleset=🤖 Claude,[]GEOSITE,anthropic
ruleset=🤖 Gemini,[]GEOSITE,google-gemini
ruleset=🤖 国外AI服务,[]GEOSITE,category-ai-!cn
ruleset=🤖 国内AI服务,[]GEOSITE,category-ai-cn
ruleset=📦 容器服务,[]GEOSITE,docker
ruleset=📦 容器服务,[]GEOSITE,category-container
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=💻 开发者服务,[]GEOSITE,category-dev
ruleset=📚 学术资源,[]GEOSITE,category-scholar-!cn
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=📹 YouTube,[]GEOSITE,youtube
ruleset=🎥 AppleTV+,[]GEOSITE,apple-tvplus
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🎶 TikTok,[]GEOSITE,tiktok
ruleset=🎥 Netflix,[]GEOSITE,netflix
ruleset=🎥 DisneyPlus,[]GEOSITE,disney
ruleset=🎥 HBO,[]GEOSITE,hbo
ruleset=🎥 PrimeVideo,[]GEOSITE,primevideo
ruleset=🎥 Emby,[]GEOSITE,category-emby
ruleset=🎻 Spotify,[]GEOSITE,spotify
ruleset=📺 Bahamut,[]GEOSITE,bahamut
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=📰 新闻资讯,[]GEOSITE,category-media
ruleset=🌎 国外媒体,[]GEOSITE,category-entertainment
ruleset=⏬ PT站点,[]GEOSITE,category-pt
ruleset=💳 PayPal,[]GEOSITE,paypal
ruleset=🛒 国外电商,[]GEOSITE,category-ecommerce
ruleset=🪙 加密货币,[]GEOSITE,category-cryptocurrency
ruleset=🚀 手动选择,[]GEOSITE,gfw
ruleset=📨 Telegram,[]GEOIP,telegram,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,twitter,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,facebook,no-resolve
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎥 Netflix,[]GEOIP,netflix,no-resolve
ruleset=🌍 国外域名,[]GEOSITE,geolocation-!cn
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 手动选择\`select\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=📨 Telegram\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎧 Discord\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📞 Talkatone\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📹 Zoom\`select\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🚀 手动选择\`[]🎯 全球直连
custom_proxy_group=💬 即时通讯\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🌐 社交媒体\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🚀 GitHub\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🎯 全球直连\`.*
custom_proxy_group=📦 容器服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🎯 全球直连\`.*
custom_proxy_group=💻 开发者服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🎯 全球直连\`.*
custom_proxy_group=📚 学术资源\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🎯 全球直连\`.*
custom_proxy_group=🤖 ChatGPT\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 Copilot\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 Claude\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 Gemini\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 Grok\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 国外AI服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🤖 国内AI服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎶 TikTok\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📹 YouTube\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎥 Netflix\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎥 DisneyPlus\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎥 HBO\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎥 PrimeVideo\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎥 AppleTV+\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇸🇬 新加坡节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🎯 全球直连\`.*
custom_proxy_group=🎥 Emby\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎻 Spotify\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📺 Bahamut\`select\`[]🇼🇸 台湾节点\`[]🇭🇰 香港节点\`[]🚀 手动选择\`[]🎯 全球直连\`.*
custom_proxy_group=🌎 国外媒体\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📰 新闻资讯\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🛒 国外电商\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🪙 加密货币\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=📢 谷歌FCM\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🇬 谷歌服务\`select\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=💾 OneDrive\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=💳 PayPal\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*

custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=⏬ PT站点\`select\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🎯 全球直连\`.*
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🌍 国外域名\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🐟 漏网之鱼\`select\`[]🎯 全球直连\`[]🚀 手动选择\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`.*
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇨🇦 加拿大节点\`url-test\`(🇨🇦|加拿大|\\bCA(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Canada|CANADA|CAN|渥太华|温哥华|卡尔加里|蒙特利尔|Montreal|YVR|YYZ|YUL)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇬🇧 英国节点\`url-test\`(🇬🇧|英国|Britain|United Kingdom|UNITED KINGDOM|England|伦敦|曼彻斯特|Manchester|\\bUK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|GBR|LHR|MAN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇫🇷 法国节点\`url-test\`(🇫🇷|法国|\\bFR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|France|FRANCE|FRA|巴黎|马赛|Marseille|CDG|MRS)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇩🇪 德国节点\`url-test\`(🇩🇪|德国|Germany|GERMANY|\\bDE(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|DEU|柏林|法兰克福|慕尼黑|Munich|MUC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇳🇱 荷兰节点\`url-test\`(🇳🇱|荷兰|Netherlands|NETHERLANDS|\\bNL(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|NLD|阿姆斯特丹|AMS)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇹🇷 土耳其节点\`url-test\`(🇹🇷|土耳其|Turkey|TURKEY|Türkiye|\\bTR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|TUR|IST|ANK)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇷🇺 俄罗斯节点\`url-test\`(🇷🇺|(?<!白)俄罗斯|(?<!白)俄|莫斯科|圣彼得堡|新西伯利亚|海参崴|符拉迪沃斯托克|哈巴罗夫斯克|伯力|\\bRU(?:[-_ ]?\\d+)?\\b|Russia)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🌐 其他地区\`url-test\`(^(?!.*(港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|🇭🇰|九龙|Kowloon|新界|沙田|荃湾|葵涌|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇺🇸|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|🇯🇵|关西|Kansai|KANSAI|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇸🇬|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇹🇼|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN|🇰🇷|加拿大|\\bCA(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Canada|CANADA|CAN|渥太华|温哥华|卡尔加里|蒙特利尔|Montreal|YVR|YYZ|YUL|🇨🇦|英国|Britain|United Kingdom|UNITED KINGDOM|England|伦敦|曼彻斯特|Manchester|\\bUK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|GBR|LHR|MAN|🇬🇧|法国|\\bFR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|France|FRANCE|FRA|巴黎|马赛|Marseille|CDG|MRS|🇫🇷|德国|Germany|GERMANY|\\bDE(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|DEU|柏林|法兰克福|慕尼黑|Munich|MUC|🇩🇪|荷兰|Netherlands|NETHERLANDS|\\bNL(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|NLD|阿姆斯特丹|AMS|🇳🇱|土耳其|Turkey|TURKEY|Türkiye|\\bTR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|TUR|IST|ANK|🇹🇷|🇷🇺|(?<!白)俄罗斯|(?<!白)俄|莫斯科|圣彼得堡|新西伯利亚|海参崴|符拉迪沃斯托克|哈巴罗夫斯克|伯力|\\bRU(?:[-_ ]?\\d+)?\\b|Russia|家宽|家庭宽带|住宅|Residential|低倍率|低倍|(?<![\\d\\.])0?\\.\\d+(?![0-9])(?:x|倍)?|倍率[:： ]?0?\\.\\d+)).*)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🏠 家宽节点\`url-test\`(家宽|家庭宽带|住宅|Residential)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🐢 低倍率节点\`url-test\`(低倍率|低倍|(?<![\\d\\.])0?\\.\\d+(?![0-9])(?:x|倍)?|倍率[:： ]?0?\\.\\d+)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
    clash_aethersailor_full_fallback: {
        id: 'clash_aethersailor_full_fallback',
        name: 'Aethersailor 重度分流版（故障转移）',
        target: 'clash',
        format: 'ini',
        description: '重度分流模板的故障转移版：规则一致，主选择组改为 fallback。',
        content: `[custom]
ruleset=🎯 全球直连,[]GEOSITE,private
ruleset=🎯 全球直连,[]GEOIP,private,no-resolve
ruleset=🎯 全球直连,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Domain.mrs,1800
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Direct_Classical_IP.yaml,28800
ruleset=🚀 故障转移,clash-domain:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Domain.mrs,28800
ruleset=🚀 故障转移,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Proxy_Classical_IP.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-games@cn
ruleset=🎯 全球直连,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Steam_CDN_Classical.yaml,28800
ruleset=🎯 全球直连,[]GEOSITE,category-game-platforms-download
ruleset=🎯 全球直连,[]GEOSITE,category-public-tracker
ruleset=📹 Zoom,[]GEOSITE,zoom
ruleset=📞 Talkatone,[]GEOSITE,talkatone
ruleset=📨 Telegram,[]GEOSITE,telegram
ruleset=🎧 Discord,[]GEOSITE,discord
ruleset=💬 即时通讯,[]GEOSITE,category-communication
ruleset=🤖 Grok,[]GEOSITE,xai
ruleset=🌐 社交媒体,[]GEOSITE,category-social-media-!cn
ruleset=🤖 ChatGPT,[]GEOSITE,openai
ruleset=💾 OneDrive,[]GEOSITE,onedrive
ruleset=🤖 Copilot,[]GEOSITE,bing
ruleset=🤖 Claude,[]GEOSITE,anthropic
ruleset=🤖 Gemini,[]GEOSITE,google-gemini
ruleset=🤖 国外AI服务,[]GEOSITE,category-ai-!cn
ruleset=🤖 国内AI服务,[]GEOSITE,category-ai-cn
ruleset=📦 容器服务,[]GEOSITE,docker
ruleset=📦 容器服务,[]GEOSITE,category-container
ruleset=🚀 GitHub,[]GEOSITE,github
ruleset=💻 开发者服务,[]GEOSITE,category-dev
ruleset=📚 学术资源,[]GEOSITE,category-scholar-!cn
ruleset=🚀 测速工具,[]GEOSITE,category-speedtest
ruleset=🎮 Steam,[]GEOSITE,steam
ruleset=📹 YouTube,[]GEOSITE,youtube
ruleset=🎥 AppleTV+,[]GEOSITE,apple-tvplus
ruleset=🍎 苹果服务,[]GEOSITE,apple
ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft
ruleset=📢 谷歌FCM,[]GEOSITE,googlefcm
ruleset=🇬 谷歌服务,[]GEOSITE,google
ruleset=🎶 TikTok,[]GEOSITE,tiktok
ruleset=🎥 Netflix,[]GEOSITE,netflix
ruleset=🎥 DisneyPlus,[]GEOSITE,disney
ruleset=🎥 HBO,[]GEOSITE,hbo
ruleset=🎥 PrimeVideo,[]GEOSITE,primevideo
ruleset=🎥 Emby,[]GEOSITE,category-emby
ruleset=🎻 Spotify,[]GEOSITE,spotify
ruleset=📺 Bahamut,[]GEOSITE,bahamut
ruleset=🎮 游戏平台,[]GEOSITE,category-games
ruleset=📰 新闻资讯,[]GEOSITE,category-media
ruleset=🌎 国外媒体,[]GEOSITE,category-entertainment
ruleset=⏬ PT站点,[]GEOSITE,category-pt
ruleset=💳 PayPal,[]GEOSITE,paypal
ruleset=🛒 国外电商,[]GEOSITE,category-ecommerce
ruleset=🪙 加密货币,[]GEOSITE,category-cryptocurrency
ruleset=🚀 故障转移,[]GEOSITE,gfw
ruleset=📨 Telegram,[]GEOIP,telegram,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,twitter,no-resolve
ruleset=🌐 社交媒体,[]GEOIP,facebook,no-resolve
ruleset=🇬 谷歌服务,[]GEOIP,google,no-resolve
ruleset=🎥 Netflix,[]GEOIP,netflix,no-resolve
ruleset=🌍 国外域名,[]GEOSITE,geolocation-!cn
ruleset=🎯 全球直连,[]GEOSITE,cn
ruleset=🎯 全球直连,[]GEOIP,cn,no-resolve
ruleset=🔀 非标端口,clash-classic:https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule/Custom_Port_Direct.yaml,28800
ruleset=🐟 漏网之鱼,[]FINAL

custom_proxy_group=🚀 故障转移\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=♻️ 自动选择\`url-test\`.*\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=📨 Telegram\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎧 Discord\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📞 Talkatone\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📹 Zoom\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=💬 即时通讯\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🌐 社交媒体\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🚀 GitHub\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📦 容器服务\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=💻 开发者服务\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📚 学术资源\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 ChatGPT\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 Copilot\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 Claude\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 Gemini\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 Grok\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 国外AI服务\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🤖 国内AI服务\`select\`[]🎯 全球直连\`[]🚀 故障转移\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点
custom_proxy_group=🎶 TikTok\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📹 YouTube\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 Netflix\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 DisneyPlus\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 HBO\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 PrimeVideo\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 AppleTV+\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎥 Emby\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🎻 Spotify\`fallback\`[]🇸🇬 新加坡节点\`[]🇯🇵 日本节点\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📺 Bahamut\`fallback\`[]🇼🇸 台湾节点\`[]🇭🇰 香港节点\`[]🚀 故障转移\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🌎 国外媒体\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📰 新闻资讯\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🛒 国外电商\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🪙 加密货币\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=📢 谷歌FCM\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🇬 谷歌服务\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🍎 苹果服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=Ⓜ️ 微软服务\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=💾 OneDrive\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=💳 PayPal\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=🎮 游戏平台\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=🎮 Steam\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=⏬ PT站点\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`[]🎯 全球直连\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🚀 测速工具\`select\`[]🎯 全球直连\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择
custom_proxy_group=🌍 国外域名\`select\`[]🎯 全球直连\`[]🚀 故障转移\`[]♻️ 自动选择\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点
custom_proxy_group=🐟 漏网之鱼\`fallback\`[]🇭🇰 香港节点\`[]🇺🇸 美国节点\`[]🇯🇵 日本节点\`[]🇸🇬 新加坡节点\`[]🇼🇸 台湾节点\`[]🇰🇷 韩国节点\`[]🇨🇦 加拿大节点\`[]🇬🇧 英国节点\`[]🇫🇷 法国节点\`[]🇩🇪 德国节点\`[]🇳🇱 荷兰节点\`[]🇹🇷 土耳其节点\`[]🇷🇺 俄罗斯节点\`[]🌐 其他地区\`[]🏠 家宽节点\`[]🐢 低倍率节点\`[]♻️ 自动选择\`https://www.gstatic.com/generate_204\`300,5
custom_proxy_group=🔀 非标端口\`select\`[]🐟 漏网之鱼\`[]🎯 全球直连
custom_proxy_group=🇭🇰 香港节点\`url-test\`(🇭🇰|港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|九龙|Kowloon|新界|沙田|荃湾|葵涌)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇺🇸 美国节点\`url-test\`(🇺🇸|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇯🇵 日本节点\`url-test\`(🇯🇵|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|关西|Kansai|KANSAI)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇸🇬 新加坡节点\`url-test\`(🇸🇬|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇼🇸 台湾节点\`url-test\`(🇹🇼|🇼🇸|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇰🇷 韩国节点\`url-test\`(🇰🇷|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇨🇦 加拿大节点\`url-test\`(🇨🇦|加拿大|\\bCA(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Canada|CANADA|CAN|渥太华|温哥华|卡尔加里|蒙特利尔|Montreal|YVR|YYZ|YUL)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇬🇧 英国节点\`url-test\`(🇬🇧|英国|Britain|United Kingdom|UNITED KINGDOM|England|伦敦|曼彻斯特|Manchester|\\bUK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|GBR|LHR|MAN)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇫🇷 法国节点\`url-test\`(🇫🇷|法国|\\bFR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|France|FRANCE|FRA|巴黎|马赛|Marseille|CDG|MRS)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇩🇪 德国节点\`url-test\`(🇩🇪|德国|Germany|GERMANY|\\bDE(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|DEU|柏林|法兰克福|慕尼黑|Munich|MUC)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇳🇱 荷兰节点\`url-test\`(🇳🇱|荷兰|Netherlands|NETHERLANDS|\\bNL(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|NLD|阿姆斯特丹|AMS)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇹🇷 土耳其节点\`url-test\`(🇹🇷|土耳其|Turkey|TURKEY|Türkiye|\\bTR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|TUR|IST|ANK)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🇷🇺 俄罗斯节点\`url-test\`(🇷🇺|(?<!白)俄罗斯|(?<!白)俄|莫斯科|圣彼得堡|新西伯利亚|海参崴|符拉迪沃斯托克|哈巴罗夫斯克|伯力|\\bRU(?:[-_ ]?\\d+)?\\b|Russia)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🌐 其他地区\`url-test\`(^(?!.*(港|\\bHK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|hk|Hong Kong|Hongkong|Hong kong|HongKong|hongkong|HONG KONG|HONGKONG|深港|HKG|🇭🇰|九龙|Kowloon|新界|沙田|荃湾|葵涌|美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|纽约|纽纽|亚特兰大|迈阿密|华盛顿|\\bUS(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|United States|UnitedStates|UNITED STATES|USA|America|AMERICA|JFK|EWR|IAD|ATL|ORD|MIA|NYC|LAX|SFO|SEA|DFW|SJC|🇺🇸|日本|川日|东京|大阪|泉日|埼玉|沪日|深日|(?<!尼|-)日|\\bJP(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Japan|JAPAN|JPN|NRT|HND|KIX|TYO|OSA|🇯🇵|关西|Kansai|KANSAI|新加坡|坡|狮城|\\bSG(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Singapore|SINGAPORE|SIN|🇸🇬|台|新北|彰化|\\bTW(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Taiwan|TAIWAN|TWN|TPE|ROC|🇹🇼|\\bKR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Korea|KOREA|KOR|首尔|韩|韓|春川|Chuncheon|ICN|🇰🇷|加拿大|\\bCA(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|Canada|CANADA|CAN|渥太华|温哥华|卡尔加里|蒙特利尔|Montreal|YVR|YYZ|YUL|🇨🇦|英国|Britain|United Kingdom|UNITED KINGDOM|England|伦敦|曼彻斯特|Manchester|\\bUK(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|GBR|LHR|MAN|🇬🇧|法国|\\bFR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|France|FRANCE|FRA|巴黎|马赛|Marseille|CDG|MRS|🇫🇷|德国|Germany|GERMANY|\\bDE(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|DEU|柏林|法兰克福|慕尼黑|Munich|MUC|🇩🇪|荷兰|Netherlands|NETHERLANDS|\\bNL(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|NLD|阿姆斯特丹|AMS|🇳🇱|土耳其|Turkey|TURKEY|Türkiye|\\bTR(?:[-_ ]?\\d+(?:[-_ ]?[A-Za-z]{2,})?)?\\b|TUR|IST|ANK|🇹🇷|🇷🇺|(?<!白)俄罗斯|(?<!白)俄|莫斯科|圣彼得堡|新西伯利亚|海参崴|符拉迪沃斯托克|哈巴罗夫斯克|伯力|\\bRU(?:[-_ ]?\\d+)?\\b|Russia|家宽|家庭宽带|住宅|Residential|低倍率|低倍|(?<![\\d\\.])0?\\.\\d+(?![0-9])(?:x|倍)?|倍率[:： ]?0?\\.\\d+)).*)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🏠 家宽节点\`url-test\`(家宽|家庭宽带|住宅|Residential)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🐢 低倍率节点\`url-test\`(低倍率|低倍|(?<![\\d\\.])0?\\.\\d+(?![0-9])(?:x|倍)?|倍率[:： ]?0?\\.\\d+)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🎯 全球直连\`select\`[]DIRECT\`https://www.gstatic.com/generate_204

enable_rule_generator=true
overwrite_original_rules=true`,
    },
};

export function getBuiltinTemplate(templateId: any) {
    return (BUILTIN_TEMPLATE_REGISTRY as Record<string, any>)[templateId] || null;
}
