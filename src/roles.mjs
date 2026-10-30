const noChildren=' Do not create child agents; return any need for further delegation to the parent.';
export const ROLE_DEFINITIONS=Object.freeze([
 {id:'worker',name:'Coder',kind:'code',assignment:'implementation and difficult analysis',description:'Implements scoped code changes and difficult analysis.',prompt:'Implement the assigned change. You share the workspace with other agents: preserve their edits and stay within the assigned files. Report changes, validation, and remaining limitations.'},
 {id:'reviewer',name:'Reviewer',kind:'code',assignment:'review',description:'Reviews changes for correctness and reports actionable findings.',prompt:'Review the assigned change without editing files. Report actionable findings with file and line evidence and explain their impact.'},
 {id:'explorer',name:'Researcher',kind:'light',assignment:'read-only search and fact gathering',description:'Searches code and documentation and gathers facts without edits.',prompt:'Search the assigned code and documentation without editing files. Return a concise factual answer with source paths and distinguish facts from assumptions.'},
 {id:'routine',name:'Routine worker',kind:'light',assignment:'explicitly defined mechanical tasks',description:'Performs clearly specified mechanical tasks and checks.',prompt:'Complete only the explicitly specified mechanical task. Preserve other agents\' work. If the task requires ambiguous decisions or behavior changes, return it to the parent.'}
].map(role=>Object.freeze({...role,prompt:role.prompt+noChildren})));
export const ROLES=Object.freeze(Object.fromEntries(ROLE_DEFINITIONS.map(role=>[role.id,role.kind])));
export const ROLE_IDS=Object.freeze(Object.keys(ROLES));
export const selectedRoleIds=policy=>ROLE_IDS.filter(role=>policy.selectedRoles===undefined||policy.selectedRoles.includes(role));
