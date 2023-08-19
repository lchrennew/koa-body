/**
 * koa-body - index.js
 * Copyright(c) 2014
 * MIT Licensed
 *
 * @author  Daryl Lau (@dlau)
 * @author  Charlike Mike Reagent (@tunnckoCore)
 * @api private
 */
import buddy from "es-co-body";
import forms from "formidable";
import symbolUnparsed from "./unparsed.js";

const jsonTypes = [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report'
];

/**
 * Donable formidable
 *
 * @param  {Stream} ctx
 * @param  {Object} opts
 * @return {Promise}
 * @api private
 */
const formy = (ctx, opts) => new Promise((resolve, reject) => {
    const fields = {};
    const files = {};
    const form = new forms.IncomingForm(opts);
    form.on('end', () => resolve({
        fields,
        files
    }))
        .on('error', err => reject(err))
        .on('field', (field, value) => {
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
    if (opts.onFileBegin) form.on('fileBegin', opts.onFileBegin);
    form.parse(ctx.req);
});


/**
 * Check if multipart handling is enabled and that this is a multipart request
 *
 * @param  {Object} ctx
 * @param  {Object} opts
 * @return {Boolean} true if request is multipart and being treated as so
 * @api private
 */
const isMultiPart = (ctx, opts) => opts.multipart && ctx.is('multipart');


/**
 *
 * @param {Object} options
 * @see https://github.com/dlau/koa-body
 * @api public
 */
export default opts => {
    opts = {
        onError: false,
        patchNode: false,
        patchKoa: true,
        multipart: false,
        urlencoded: true,
        json: true,
        text: true,
        encoding: 'utf-8',
        jsonLimit: '1mb',
        jsonStrict: true,
        formLimit: '56kb',
        queryString: null,
        formidable: {},
        includeUnparsed: false,
        textLimit: '56kb',
        ...opts,
        parsedMethods: opts?.parsedMethods?.map?.(method => method.toUpperCase()) ?? [ 'POST', 'PUT', 'PATCH' ],
    };

    return (ctx, next) => {
        let bodyPromise;
        // only parse the body on specifically chosen methods
        if (opts.parsedMethods.includes(ctx.method.toUpperCase())) {
            try {
                if (opts.json && ctx.is(jsonTypes)) {
                    bodyPromise = buddy.json(ctx, {
                        encoding: opts.encoding,
                        limit: opts.jsonLimit,
                        strict: opts.jsonStrict,
                        returnRawBody: opts.includeUnparsed
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
                if (opts.onError instanceof Function) {
                    opts.onError(parsingError, ctx);
                } else {
                    throw parsingError;
                }
            }
        }

        bodyPromise ??= Promise.resolve({});
        return bodyPromise.catch(parsingError => {
            if (opts.onError instanceof Function) {
                opts.onError(parsingError, ctx);
            } else {
                throw parsingError;
            }
            return next();
        })
            .then(body => {
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
