import * as Koa from "koa";
import { Files } from 'formidable';

declare module "koa" {
    interface Request extends Koa.BaseRequest {
        body?: any;
        files?: Files;
    }
}

declare namespace koaBody {
    interface IKoaBodyFormidableOptions {

        /**
         * {Integer} 限制所有字段（不包括文件）可分配的内存大小（字节）。如果超过此值，将触发 'error' 事件。默认大小为 20MB。
         */
        maxFileSize?: number;

        /**
         * {Integer} 限制 querystring 解析器将解码的字段数量，默认为 1000。
         */
        maxFields?: number;

        /**
         * {Integer} 限制所有字段（不包括文件）可分配的内存大小（字节）。
         * 如果超过此值，将触发 'error' 事件。默认为 2mb (2 * 1024 * 1024)。
         */
        maxFieldsSize?: number;

        /**
         * {String} 设置上传文件的存放目录，默认为 os.tmpDir()。
         */
        uploadDir?: string;

        /**
         * {Boolean} 写入 uploadDir 的文件是否包含原始文件的扩展名，默认为 false。
         */
        keepExtensions?: boolean;

        /**
         * {String} 如果希望计算传入文件的校验和，将其设置为 'sha1' 或 'md5'，默认为 false。
         */
        hash?: string;

        /**
         * {Boolean} 是否支持多文件上传，默认为 true。
         */
        multiples?: boolean;

        /**
         * {Function} 文件开始上传时的特殊回调。该函数由 formidable 直接执行。
         * 可用于在文件保存到磁盘之前对其重命名。详见 https://github.com/felixge/node-formidable#filebegin
         */
        onFileBegin?: (name: string, file: any) => void;
    }
    interface IKoaBodyOptions {
        /**
         * {Boolean} 将请求体附加到 Node 的 ctx.req 上，默认为 false。
         *
         * 注意：如果需要，可以同时将请求体附加到 Node 和 Koa 的请求对象上。
         */
        patchNode?: boolean;

        /**
         * {Boolean} 将请求体附加到 Koa 的 ctx.request 上，默认为 true。
         *
         * 注意：如果需要，可以同时将请求体附加到 Node 和 Koa 的请求对象上。
         */
        patchKoa?: boolean;

        /**
         * {String|Integer} JSON 请求体的字节限制（如果是整数），默认为 1mb。
         */
        jsonLimit?: string|number;

        /**
         * {String|Integer} 表单请求体的字节限制（如果是整数），默认为 56kb。
         */
        formLimit?: string|number;

        /**
         * {String|Integer} yaml请求体的字节限制（如果是整数），默认为 1mb。
         */
        yamlLimit?: string|number;

        /**
         * {String|Integer} 文本请求体的字节限制（如果是整数），默认为 56kb。
         */
        textLimit?: string|number;

        /**
         * {String} 设置传入表单字段的编码，默认为 utf-8。
         */
        encoding?: string;

        /**
         * {Boolean} 是否解析 multipart 请求体，默认为 false。
         */
        multipart?: boolean;

        /**
         * {Boolean} 是否解析 urlencoded 请求体，默认为 true。
         */
        urlencoded?: boolean;

        /**
         * {Boolean} 是否解析文本请求体，默认为 true。
         */
        text?: boolean;

        /**
         * {Boolean} 是否解析 json 请求体，默认为 true。
         */
        json?: boolean;

        /**
         * {Boolean} 是否解析 yaml 请求体，默认为 true。
         */
        yaml?: boolean;

        /**
         * 切换 co-body 的严格模式；如果为 true，只解析数组或对象，默认为 true。
         */
        jsonStrict?: boolean;

        /**
         * 切换 co-body 的 returnRawBody 模式；如果为 true，
         * 可以使用 Symbol('unparsedBody') 获取原始请求体。
         *
         * ```
         // 获取 Symbol:
         const unparsed = require('koa-body/unparsed.js');
         // 或者
         const unparsed = Symbol.for('unparsedBody');
         
         // 之后访问原始数据:
         ctx.request.body[unparsed]
         ```
         * 默认为 false
         */
        includeUnparsed?: boolean;

        /**
         * {Object} 传递给 formidable multipart 解析器的配置项
         */
        formidable?: IKoaBodyFormidableOptions;

        /**
         * {Function} 自定义错误处理函数。如果抛出错误，可以自定义响应 - onError(error, context)。默认会抛出异常。
         */
        onError?: (err: Error, ctx: Koa.Context) => void;

        /**
         * {Boolean} 如果启用，则不解析 GET、HEAD、DELETE 请求；已被废弃。
         *
         * GET、HEAD 和 DELETE 请求的请求体没有明确定义的语义，
         * 但这并不意味着它们在某些使用场景中是无效的。
         * koa-body 默认是严格的。
         *
         * 详见 http://tools.ietf.org/html/draft-ietf-httpbis-p2-semantics-19#section-6.3
         */
        strict?: boolean;

        /**
         * {String[]} 允许解析请求体的 HTTP 方法；应优先于 strict 模式使用。
         *
         * GET、HEAD 和 DELETE 请求的请求体没有明确定义的语义，
         * 但这并不意味着它们在某些使用场景中是无效的。
         * koa-body 默认只会解析 POST、PUT 和 PATCH 的 HTTP 请求体。
         *
         * 详见 http://tools.ietf.org/html/draft-ietf-httpbis-p2-semantics-19#section-6.3
         */
        parsedMethods?: string[];
    }
}

declare function koaBody (options?: koaBody.IKoaBodyOptions): Koa.Middleware<{}, {}>;

export = koaBody;