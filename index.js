/**
 * koa-body - index.js
 * Copyright(c) 2014
 * MIT Licensed
 *
 * @author  Daryl Lau (@dlau)
 * @author  Charlike Mike Reagent (@tunnckoCore)
 * @api private
 */
import * as buddy from "es-co-body";
import forms from "formidable";
import symbolUnparsed from "./unparsed.js";
import yaml from "yaml";

// 定义支持解析的 JSON 类型数组
const jsonTypes = [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report'
];

// 定义支持解析的 YAML 类型数组
const yamlTypes = [
    'text/yaml',
    'application/yaml',
    'application/x-yaml'
];

/**
 * 包装 formidable，返回一个 Promise 以支持 async/await
 *
 * @param  {Stream} ctx koa 上下文
 * @param  {Object} opts formidable 的配置项
 * @return {Promise} 解析成功返回包含 fields 和 files 的对象
 * @api private
 */
const formy = (ctx, opts) => new Promise((resolve, reject) => {
    const fields = {};
    const files = {};
    const form = forms(opts);
    form.on('end', () => resolve({
        fields,
        files
    }))
        .on('error', err => reject(err))
        .on('field', (field, value) => {
            // 处理同名字段，将其转为数组存储
            if (fields[field]) {
                if (Array.isArray(fields[field])) {
                    fields[field].push(value);
                } else {
                    fields[field] = [ fields[field], value ];
                }
            } else {
                fields[field] = value;
            }
        })
        .on('file', (field, file) => {
            // 处理同名文件，将其转为数组存储
            if (files[field]) {
                if (Array.isArray(files[field])) {
                    files[field].push(file);
                } else {
                    files[field] = [ files[field], file ];
                }
            } else {
                files[field] = file;
            }
        });
    // 如果配置了 onFileBegin 回调，则绑定事件
    if (opts.onFileBegin) form.on('fileBegin', opts.onFileBegin);
    // 开始解析请求
    form.parse(ctx.req);
});


/**
 * 检查是否启用了 multipart 并且当前请求是否为 multipart 格式
 *
 * @param  {Object} ctx koa 上下文
 * @param  {Object} opts 配置项
 * @return {Boolean} 如果是 multipart 请求并需要处理则返回 true
 * @api private
 */
const isMultiPart = (ctx, opts) => opts.multipart && ctx.is('multipart');


/**
 * koa-body 中间件主体
 *
 * @param {Object} opts 配置项
 * @see https://github.com/dlau/koa-body
 * @api public
 */
export default opts => {
    // 初始化默认配置
    opts = {
        onError: false,
        patchNode: false,
        patchKoa: true,
        multipart: false,
        urlencoded: true,
        json: true,
        text: true,
        yaml: true,
        encoding: 'utf-8',
        jsonLimit: '1mb',
        jsonStrict: true,
        yamlLimit: '1mb',
        formLimit: '56kb',
        queryString: null,
        formidable: {},
        includeUnparsed: false,
        textLimit: '56kb',
        ...opts,
        // 默认只解析 POST、PUT 和 PATCH 方法
        parsedMethods: opts?.parsedMethods?.map?.(method => method.toUpperCase()) ?? [ 'POST', 'PUT', 'PATCH' ],
    };

    // 返回 koa 中间件函数
    return (ctx, next) => {
        let bodyPromise;
        // 仅当请求方法在允许的列表中时，才解析请求体
        if (opts.parsedMethods.includes(ctx.method.toUpperCase())) {
            try {
                // 根据不同的 Content-Type 调用对应的解析器
                if (opts.json && ctx.is(jsonTypes)) {
                    bodyPromise = buddy.json(ctx, {
                        encoding: opts.encoding,
                        limit: opts.jsonLimit,
                        strict: opts.jsonStrict,
                        returnRawBody: opts.includeUnparsed
                    });
                } else if (opts.yaml && ctx.is(yamlTypes)) {
                    bodyPromise = buddy.text(ctx, {
                        encoding: opts.encoding,
                        limit: opts.yamlLimit,
                        returnRawBody: opts.includeUnparsed
                    }).then(body => {
                        // 如果 opts.includeUnparsed 为 true，buddy.text 返回 { parsed: string, raw: string }
                        const str = opts.includeUnparsed ? body.parsed : body;
                        const parsed = yaml.parse(str);
                        return opts.includeUnparsed ? { parsed, raw: body.raw } : parsed;
                    });
                } else if (opts.urlencoded && ctx.is('urlencoded')) {
                    const {
                        encoding,
                        formLimit: limit,
                        queryString,
                        includeUnparsed: returnRawBody,
                    } = opts
                    bodyPromise = buddy.form(ctx, { encoding, limit, queryString, returnRawBody });
                } else if (opts.text && ctx.is('text/*')) {
                    const { encoding, textLimit: limit, includeUnparsed: returnRawBody } = opts
                    bodyPromise = buddy.text(ctx, { encoding, limit, returnRawBody });
                } else if (opts.multipart && ctx.is('multipart')) {
                    bodyPromise = formy(ctx, opts.formidable);
                }
            } catch (parsingError) {
                // 解析时抛出异常的错误处理
                if (opts.onError instanceof Function) {
                    opts.onError(parsingError, ctx);
                } else {
                    throw parsingError;
                }
            }
        }

        // 如果没有匹配的解析器，则直接返回空对象的 Promise
        bodyPromise ??= Promise.resolve({});
        
        return bodyPromise.catch(parsingError => {
            // 处理 Promise 拒绝的错误
            if (opts.onError instanceof Function) {
                opts.onError(parsingError, ctx);
            } else {
                throw parsingError;
            }
            return next();
        })
            .then(body => {
                // 将解析后的数据附加到 Node 原生 req 对象上
                if (opts.patchNode) {
                    if (isMultiPart(ctx, opts)) {
                        ctx.req.body = body.fields;
                        ctx.req.files = body.files;
                    } else if (opts.includeUnparsed) {
                        ctx.req.body = body.parsed || {};
                        if (!ctx.is('text/*')) {
                            ctx.req.body[symbolUnparsed] = body.raw;
                        }
                    } else {
                        ctx.req.body = body;
                    }
                }
                // 将解析后的数据附加到 Koa 的 request 对象上
                if (opts.patchKoa) {
                    if (isMultiPart(ctx, opts)) {
                        ctx.request.body = body.fields;
                        ctx.request.files = body.files;
                    } else if (opts.includeUnparsed) {
                        ctx.request.body = body.parsed || {};
                        if (!ctx.is('text/*')) {
                            ctx.request.body[symbolUnparsed] = body.raw;
                        }
                    } else {
                        ctx.request.body = body;
                    }
                }
                return next();
            })
    };
};
