import { supabase } from "/js/supabase-client.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
(async()=>{
  try{
    const [{ data: page, error: pageError }, { data: settings, error: settingsError }] =
  await Promise.all([
    supabase.from("blog_page").select("*").eq("id", 1).maybeSingle(),
    supabase.from("site_settings").select("phone,email,quote_url").eq("id", 1).maybeSingle()
  ]);

const { data: posts, error: postsError } = await supabase
  .from("blog_posts")
  .select("id,title,slug,excerpt,featured_image_url,image_alt,published_at,display_date")
  .eq("published", true)
  .order("published_at", { ascending: false });

if (postsError) throw postsError;
    const p=page||{}; document.title=p.seo_title||"Blog | Group Travel Airlines";
    const meta=document.querySelector('meta[name="description"]'); if(meta)meta.content=p.meta_description||meta.content;
    document.getElementById("blogEyebrow").textContent=p.eyebrow||"GROUP TRAVEL AIRLINES";
    document.getElementById("blogTitle").textContent=p.title||"Travel Insights & Helpful Guides";
    document.getElementById("blogDescription").textContent=p.description||"";
    document.getElementById("blogEmpty").textContent=p.empty_message||"No published articles yet.";
    if(settings?.phone){const e=document.getElementById("footerPhone");e.textContent=settings.phone;e.href=`tel:+${settings.phone.replace(/\D/g,"")}`}
    if(settings?.email){const e=document.getElementById("footerEmail");e.textContent=settings.email;e.href=`mailto:${settings.email}`}
    if(settings?.quote_url)document.getElementById("footerMain").href=settings.quote_url;
    if(!posts?.length){document.getElementById("blogEmpty").hidden=false;return;}
    const grid=document.getElementById("blogGrid"); document.getElementById("blogEmpty").hidden=true;
    grid.innerHTML=posts.map(p=>{
      const slug=String(p.slug||"").replace(/^\/+|\/+$/g,"");
      const date=p.display_date||new Date(p.published_at||Date.now()).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
      return `<article class="card"><img src="${esc(p.featured_image_url||"/assets/blog-default.jpg")}" alt="${esc(p.image_alt||p.title||"")}"><div class="body"><div class="date">${esc(date)}</div><h2>${esc(p.title||"")}</h2><p>${esc(p.excerpt||"")}</p><a class="read" href="/blog/${encodeURIComponent(slug)}">Read article →</a></div></article>`;
    }).join("");
  }catch(e){console.warn(e);document.getElementById("blogEmpty").hidden=false;}
})();
