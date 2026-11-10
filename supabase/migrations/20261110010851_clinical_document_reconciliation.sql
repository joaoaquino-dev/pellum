begin;
create or replace function aura_private.clinical_document_envelope(p_provider text,p_envelope text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('documentId',d.id,'sourceDigest',d.source_digest,'requiredSignature',d.required_signature,'preparedSha256',e.prepared_sha256,'provider',e.provider,'envelopeId',e.envelope_id,
  'state',(select state_after from public.aura_clinical_document_events where document_id=d.id order by id desc limit 1))
 from aura_private.clinical_signature_envelopes e join public.aura_clinical_documents d on d.id=e.document_id where e.provider=p_provider and e.envelope_id=p_envelope
$$;
revoke all on function aura_private.clinical_document_envelope(text,text) from public,anon,authenticated;
grant execute on function aura_private.clinical_document_envelope(text,text) to service_role;
create function aura_private.clinical_document_binding(p_document uuid) returns jsonb language sql security definer set search_path='' as $$
 select aura_private.clinical_document_envelope(e.provider,e.envelope_id) from aura_private.clinical_signature_envelopes e where e.document_id=p_document
$$;
revoke all on function aura_private.clinical_document_binding(uuid) from public,anon,authenticated;
grant execute on function aura_private.clinical_document_binding(uuid) to service_role;
create function public.aura_clinical_document_binding(p_document uuid) returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_document_binding(p_document)$$;
revoke all on function public.aura_clinical_document_binding(uuid) from public,anon,authenticated;
grant execute on function public.aura_clinical_document_binding(uuid) to service_role;
commit;
