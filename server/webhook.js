import crypto from 'crypto';

export function verify(req, res, next){
  const secret = process.env.WEBHOOK_SECRET;
  const sig = req.headers['x-trello-webhook'];
  if (!secret || !sig) return next();
  const hmac = crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('base64');
  if (hmac !== sig) return res.status(401).send('bad sig');
  next();
}