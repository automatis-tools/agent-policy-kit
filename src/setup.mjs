import { detectClients, resolveClient, summarizeDetection } from './detect.mjs';
import { planInstall, applyInstall, summarizePlan } from './install.mjs';

const ERRORS = new Set(['INVALID_CLIENT','INVALID_POLICY','INVALID_JSON','INVALID_TOML','UNSUPPORTED_CONFIG','UNSUPPORTED_TOML_STRUCTURE','UNSUPPORTED_TOML_VALUE','CODEX_CAP_ALIAS_CONFLICT','OWNERSHIP_CONFLICT','INVALID_RECEIPT','OWNED_DRIFT','INSTALLATION_CONFLICT','POLICY_CONFLICT','UNSAFE_PATH','UNSAFE_FILE','STALE_PLAN','RECOVERY_REQUIRED','ROLLBACK_CONFLICT','INVALID_PLAN','PLATFORM_UNSUPPORTED','INSTALL_LOCKED','INSTALL_FAILED','EACCES','EPERM','ENOENT','ENOSPC','EIO','EROFS']);
const safeError = error => ERRORS.has(error?.code) ? error.code : 'SETUP_FAILED';
function actions(client,warnings) {
  if (client === 'agy') return [{client,code:'exact_model_enforcement_unsupported',automatable:false}];
  const result = [{client,code:client === 'codex' ? 'native_hook_trust_required' : 'native_hook_load_check_required',automatable:client !== 'codex'}];
  if (warnings.includes('kimi-native-pool-unverified')) result.push({client,code:'kimi_native_pool_required',automatable:true});
  return result;
}

export async function setupDetected({home,stateDir,policyPath,packageRoot,nodePath,apply=false,client=null,env=process.env,hostHome} = {}) {
  const records = client === null ? await detectClients({env,hostHome}) : [await resolveClient(client,{env,hostHome})];
  const detected = summarizeDetection(records), results = [], requiredActions = [];
  const available = records.filter(r=>r.status === 'detected');
  for (const record of records) {
    if (record.status !== 'detected') {
      results.push({client:record.client,status:record.status});
      if (record.status === 'invalid' || record.status === 'timeout') requiredActions.push({client:record.client,code:record.status === 'timeout' ? 'native_client_detection_timeout' : 'native_client_identity_unverified',automatable:true});
      continue;
    }
    try {
      // Planning and applying are sequential per client: the preceding transaction
      // can create shared policy/receipts that the next plan must capture afresh.
      const plan = await planInstall({client:record.client,home,stateDir,policyPath,packageRoot,nodePath});
      requiredActions.push(...actions(record.client,plan.warnings));
      if (plan.status === 'unsupported') { results.push({client:record.client,status:'unsupported',plan:summarizePlan(plan)}); continue; }
      if (apply) {
        const result = await applyInstall(plan);
        results.push({client:record.client,status:result.status === 'unchanged' ? 'unchanged' : 'configured',changedFiles:result.changedFiles});
      } else results.push({client:record.client,status:'planned',plan:summarizePlan(plan)});
    } catch (error) {
      const code = safeError(error);
      results.push({client:record.client,status:'error',error:code});
      requiredActions.push({client:record.client,code,automatable:false});
    }
  }
  const failed = results.some(r=>['error','unsupported','invalid','timeout'].includes(r.status));
  return {schemaVersion:1,status:available.length === 0 ? 'no_clients' : failed ? 'partial' : apply ? 'configured' : 'planned',detected,results,requiredActions,exitCode:available.length === 0 || failed ? 3 : 0};
}
