/**
 * koa-body - unparsed.js
 * Copyright(c) 2014
 * MIT Licensed
 *
 * @author  Daryl Lau (@dlau)
 * @author  Charlike Mike Reagent (@tunnckoCore)
 * @author  Zev Isert (@zevisert)
 * @api private
 */

// 导出一个全局唯一的 Symbol，用于存储未解析的原始请求体数据
export default Symbol.for('unparsedBody');
