/* One submission path for the public contact form and client portal. */
window.RENOBVA_PROJECT_FLOW = {
  draftKey: 'renobva.pending-project.v1',
  async submit(sb, details) {
    const {data:{user},error:authError} = await sb.auth.getUser();
    if(authError || !user) throw new Error('Please sign in again. Your request is still saved.');
    const {data,error} = await sb.functions.invoke('project-submission',{body:details});
    if(error) {
      let message = 'Could not create the project. Please try again.';
      try { const body=await error.context.json(); message=body.error || message; } catch {}
      throw new Error(message);
    }
    if(!data?.project_id) throw new Error('The server did not return a project reference.');
    sessionStorage.setItem('renobva.project-notice',JSON.stringify({id:data.project_id,email_status:data.email_status}));
    return data;
  }
};
