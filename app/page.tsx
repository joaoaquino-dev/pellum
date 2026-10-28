import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/');return <iframe title="Aura — Gestão estética" src="/aura/index.html" style={{position:'fixed',inset:0,width:'100%',height:'100%',border:0}}/>;}
