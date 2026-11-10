// Synthetic PostgreSQL only; not live Supabase Auth or Storage.
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from './node_modules/@electric-sql/pglite/dist/index.js';
export async function createFullSchemaFixture(accountNames=['administrator','solo_a','solo_b']){
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;grant usage on schema auth,storage to authenticated,service_role;
 create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,created_at timestamptz default now());
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),not_after timestamptz);
 create table auth.mfa_factors(id uuid default gen_random_uuid(),user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 alter table storage.objects enable row level security;`);
 const migrations=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations){try{await db.exec(await readFile('supabase/migrations/'+file,'utf8'))}catch(error){throw Error('Local migration rehearsal: '+file+' · '+error.code+' · '+error.message)}}
 const accounts={};for(const name of accountNames){
  const user=randomUUID(),session=randomUUID(),email=name+'@example.invalid';accounts[name]={user,session,email};
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,email]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 }
 const login=async(name,aal='aal1')=>{const account=accounts[name];await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:account.user,session_id:account.session,aal})]);await db.exec('set role authenticated')};
 const rpc=async(name,args)=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
 await db.query('insert into aura_private.platform_admins(email,enabled) values($1,true) on conflict(email) do update set enabled=true',[accounts.administrator.email]);
 await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts.administrator.user]);

 return {db,accounts,login,rpc,migrations};
 }catch(error){await db.close();throw error}
}
