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

const append = (obj, key, val) => {
    obj[key] = obj[key] ? (Array.isArray(obj[key]) ? [...obj[key], val] : [obj[key], val]) : val;
};

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
    
    form.on('end', () => resolve({ fields, files }))
        .on('error', err => reject(err))
        .on('field', (field, value) => append(fields, field, value))
        .on('file', (field, file) => append(files, field, file));
        
    // 如果配置了 onFileBegin 回调，则绑定事件
    if (opts?.onFileBegin) form.on('fileBegin', opts.onFileBegin);
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
const isMultiPart = (ctx, { multipart }) => multipart && ctx.is('multipart');


/**
 * 根据不同的 Content-Type 调用对应的解析器解析请求体
 */
const parsers = [
    {
        match: (ctx, { json }) => json && ctx.is(jsonTypes),
        parse: (ctx, { encoding, jsonLimit: limit, jsonStrict: strict, includeUnparsed: returnRawBody }) => buddy.json(ctx, { encoding, limit, strict, returnRawBody })
    },
    {
        match: (ctx, { yaml }) => yaml && ctx.is(yamlTypes),
        parse: async (ctx, { encoding, yamlLimit: limit, includeUnparsed: returnRawBody }) => {
            const textBody = await buddy.text(ctx, { encoding, limit, returnRawBody });
            const str = returnRawBody ? textBody.parsed : textBody;
            const parsed = yaml.parse(str);
            return returnRawBody ? { parsed, raw: textBody.raw } : parsed;
        }
    },
    {
        match: (ctx, { urlencoded }) => urlencoded && ctx.is('urlencoded'),
        parse: (ctx, { encoding, formLimit: limit, queryString, includeUnparsed: returnRawBody }) => buddy.form(ctx, { encoding, limit, queryString, returnRawBody })
    },
    {
        match: (ctx, { text }) => text && ctx.is('text/*'),
        parse: (ctx, { encoding, textLimit: limit, includeUnparsed: returnRawBody }) => buddy.text(ctx, { encoding, limit, returnRawBody })
    },
    {
        match: (ctx, { multipart }) => multipart && ctx.is('multipart'),
        parse: (ctx, { formidable }) => formy(ctx, formidable)
    }
];

const parseBody = (ctx, opts) => parsers.find(p => p.match(ctx, opts))?.parse(ctx, opts) ?? {};

/**
 * 将解析后的数据附加到对应的请求对象上
 */
const patchContext = (ctx, opts, body) => {
    const isMulti = isMultiPart(ctx, opts);
    const isText = ctx.is('text/*');

    const { patchNode, patchKoa, includeUnparsed } = opts;

    const patch = (request) => {
        if (isMulti) {
            request.body = body.fields;
            request.files = body.files;
        } else if (includeUnparsed) {
            request.body = body.parsed || {};
            if (!isText) {
                request.body[symbolUnparsed] = body.raw;
            }
        } else {
            request.body = body;
        }
    };

    if (patchNode) patch(ctx.req);
    if (patchKoa) patch(ctx.request);
};

/**
 * koa-body 中间件主体
 *
 * @param {Object} opts 配置项
 * @see https://github.com/dlau/koa-body
 * @api public
 */
export default opts => {
    // 初始化默认配置
    const options = {
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

    const { parsedMethods, onError } = options;

    // 返回 koa 中间件函数
    return async (ctx, next) => {
        let body = {};
        
        // 仅当请求方法在允许的列表中时，才解析请求体
        if (parsedMethods.includes(ctx.method.toUpperCase())) {
            try {
                body = await parseBody(ctx, options);
            } catch (parsingError) {
                // 解析时抛出异常的错误处理
                if (typeof onError === 'function') {
                    onError(parsingError, ctx);
                } else {
                    throw parsingError;
                }
                return next();
            }
        }

        patchContext(ctx, options, body);

        return next();
    };
};
