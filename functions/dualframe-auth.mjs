import {getStore} from '@netlify/blobs';
import {createService} from './lib/dualframe/service.mjs';
export default async req=>createService({store:getStore({name:'dualframe-rd-v3',consistency:'strong'}),env:key=>Netlify.env.get(key)}).handle(req);
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:12}};
