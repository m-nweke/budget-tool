import express from 'express';
import type { AuthUser } from '../types';
import type { ScenarioEvent } from '../types/finance';
import * as finance from '../repositories/financeRepository';
import { cents, forecast, validDate } from '../services/financeForecast';

const router = express.Router();
router.use((req,res,next) => {
  if (!req.user || req.user.role !== 'owner' || req.user.tenant_type !== 'personal') {res.status(403).json({error:'Personal budget owner access required.'});return;}
  next();
});
const user = (req: express.Request) => req.user as AuthUser;
const id = (value: unknown) => {const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<=0) throw new finance.FinanceError('Invalid resource ID.');return parsed;};
router.get('/bootstrap',async(req,res) => {const data=await finance.loadFinance(user(req).tenant_id);res.json({...data,forecast:forecast(data)});});
router.get('/overview',async(req,res) => {const data=await finance.loadFinance(user(req).tenant_id);res.json({...data,forecast:forecast(data)});});
router.post('/accounts',async(req,res) => {res.status(201).json(await finance.saveAccount(user(req).tenant_id,req.body));});
router.put('/accounts/:id',async(req,res) => {res.json(await finance.saveAccount(user(req).tenant_id,req.body,id(req.params.id)));});
router.post('/accounts/:id/reconcile',async(req,res) => {await finance.reconcile(user(req).tenant_id,id(req.params.id),req.body.balance_cents,req.body.date);res.json({reconciled:true});});
router.post('/movements',async(req,res) => {res.status(201).json(await finance.saveMovement(user(req).tenant_id,user(req).id,req.body));});
router.put('/movements/:id',async(req,res) => {res.json(await finance.saveMovement(user(req).tenant_id,user(req).id,req.body,id(req.params.id)));});
router.delete('/movements/:id',async(req,res) => {await finance.deleteMovement(user(req).tenant_id,id(req.params.id));res.status(204).end();});
router.post('/commitments',async(req,res) => {res.status(201).json(await finance.saveCommitment(user(req).tenant_id,req.body));});
router.put('/commitments/:key',async(req,res) => {res.json(await finance.saveCommitment(user(req).tenant_id,req.body,String(req.params.key)));});
router.delete('/commitments/:key',async(req,res) => {await finance.disableCommitment(user(req).tenant_id,String(req.params.key));res.status(204).end();});
router.put('/settings',async(req,res) => {await finance.saveSettings(user(req).tenant_id,req.body);res.json({saved:true});});
router.put('/categories/:id/essential',async(req,res) => {await finance.markEssential(user(req).tenant_id,id(req.params.id),req.body.essential);res.json({saved:true});});
router.post('/forecast',async(req,res) => {
  const data=await finance.loadFinance(user(req).tenant_id);const events=req.body.events ?? [];const disabled=req.body.disabled_commitment_keys ?? [];
  if(!Array.isArray(events)||events.length>200||!Array.isArray(disabled)||disabled.length>200) throw new finance.FinanceError('Scenario supports up to 200 events and disabled schedules.');
  for(const event of events as ScenarioEvent[]) if(!event||!validDate(event.date)||event.date<data.as_of||!cents(event.amount_cents)||!data.accounts.some(a => a.id===event.account_id)) throw new finance.FinanceError('Scenario events need a valid future date, budget account and signed integer cents.');
  if(disabled.some(key => typeof key!=='string'||!data.commitments.some(c => c.key===key))) throw new finance.FinanceError('Unknown disabled commitment.');
  res.json({baseline:forecast(data),scenario:forecast(data,events,disabled)});
});
router.post('/imports/preview',async(req,res) => {res.json(await finance.previewImport(user(req).tenant_id,req.body));});
router.post('/imports',async(req,res) => {res.status(201).json(await finance.importMovements(user(req).tenant_id,user(req).id,req.body));});
router.use((error: unknown,_req:express.Request,res:express.Response,next:express.NextFunction) => {if(error instanceof finance.FinanceError) {res.status(error.status).json({error:error.message});return;}next(error);});
export default router;
