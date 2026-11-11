import { Storage } from 'happy-dom';

// Node 22+ 暴露了实验性的 `localStorage` / `sessionStorage` 全局属性。
// 由于这些键已存在于 Node 全局对象上，Vitest 的 DOM 环境（happy-dom/jsdom）
// 不会再用 DOM 实现覆盖它们；其中 `localStorage` 在未加 `--localstorage-file`
// 启动参数时始终不可用（取值为 undefined），导致依赖它的测试直接失败。
// 这里在缺失时补绑一个独立的 happy-dom Storage 实例。
for (const key of ['localStorage', 'sessionStorage']) {
    if (typeof globalThis[key]?.getItem !== 'function') {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value: new Storage(),
        });
    }
}

// happy-dom 把 `nodeName` 的真实 getter 定义在各子类原型（Element/Comment/Document…）
// 上，而 `Node.prototype` 上只留了一个始终返回 '' 的占位 getter。
// DOMPurify 出于原型链污染防护会缓存 `Node.prototype.nodeName` 的 getter 再手动调用
// （绕过实例上可能被遮蔽的同名属性），于是拿到空字符串，认为所有标签都不在白名单内，
// 净化结果整体失效（事件属性与脚本原样保留，仅在真实浏览器/jsdom 中表现正常）。
// 这里把占位 getter 替换为沿原型链向下委托的实现。
const nodeProto = globalThis.Node?.prototype;
const sampleElement = globalThis.document?.createElement?.('mi-sub-probe');
const nodeNameDesc = nodeProto && Object.getOwnPropertyDescriptor(nodeProto, 'nodeName');
if (
    nodeProto &&
    sampleElement &&
    nodeNameDesc?.get &&
    nodeNameDesc.get.call(sampleElement) === '' &&
    sampleElement.nodeName
) {
    Object.defineProperty(nodeProto, 'nodeName', {
        configurable: true,
        get() {
            let proto = Object.getPrototypeOf(this);
            while (proto && proto !== nodeProto) {
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'nodeName');
                if (descriptor?.get) return descriptor.get.call(this);
                proto = Object.getPrototypeOf(proto);
            }
            return '';
        },
    });
}
