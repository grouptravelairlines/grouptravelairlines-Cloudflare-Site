import { supabase } from "/js/supabase-client.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
function slugFromPath(){const p=location.pathname.split("/").filter(Boolean);return p[0]==="blog"&&p[1]?decodeURIComponent(p[1]):"";}
function safeHtml(html=""){
  const allowed=new Set(["P","BR","H2","H3","UL","OL","LI","STRONG","EM","B","I","A","BLOCKQUOTE","IMG"]);
  const t=document.createElement("template");t.innerHTML=html;
  t.content.querySelectorAll("*").forEach(el=>{
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return;}
    [...el.attributes].forEach(a=>{const n=a.name.toLowerCase();if(n.startsWith("on"))el.removeAttribute(a.name);if(el.tagName!=="A"&&el.tagName!=="IMG"&&n!=="class")el.removeAttribute(a.name);});
    if(el.tagName==="A"){const href=el.getAttribute("href")||"";if(!/^(https?:|mailto:|tel:|\/|#)/i.test(href))el.removeAttribute("href");el.setAttribute("rel","noopener noreferrer");el.setAttribute("target","_blank");}
    if(el.tagName==="IMG"){const src=el.getAttribute("src")||"";if(!/^(https?:|\/)/i.test(src))el.removeAttribute("src");el.setAttribute("loading","lazy");}
  });
  return t.innerHTML;
}
(async()=>{
  const slug=slugFromPath().trim().replace(/^\/+|\/+$/g,"");
try{
  if(!slug){
    document.getElementById("articleRoot").innerHTML='<div class="error">This article could not be found.</div>';
    return;
  }

  const {data:posts,error}=await supabase
    .from("blog_posts")
    .select("*")
    .eq("published",true)
    .order("published_at",{ascending:false});

  if(error) throw error;

  const p=(posts||[]).find(post=>
    String(post.slug||"").trim().replace(/^\/+|\/+$/g,"")===slug
  );

  if(!p){
    document.getElementById("articleRoot").innerHTML='<div class="error">This article could not be found.</div>';
    return;
  }
    const canonical=`https://grouptravelairlines.pages.dev/blog/${encodeURIComponent(slug)}`;
    document.title=p.seo_title||p.title||"Group Travel Airlines";
    document.getElementById("canonical").href=canonical;
    const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=p.meta_description||p.excerpt||"";
    for(const [id,val] of [["ogTitle",p.seo_title||p.title], ["ogDescription",p.meta_description||p.excerpt||""],["ogUrl",canonical],["ogImage",p.featured_image_url||""],["twTitle",p.seo_title||p.title],["twDescription",p.meta_description||p.excerpt||""],["twImage",p.featured_image_url||""]])document.getElementById(id).content=val||"";
    document.getElementById("articleDate").textContent=p.display_date||new Date(p.published_at||Date.now()).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    document.getElementById("articleTitle").textContent=p.title||"";document.getElementById("articleExcerpt").textContent=p.excerpt||"";document.getElementById("articleByline").textContent=p.author?`By ${p.author}`:"";
    const img=document.getElementById("articleImage");if(p.featured_image_url){img.src=p.featured_image_url;img.alt=p.image_alt||p.title||"";img.hidden=false;}
    document.getElementById("articleContent").innerHTML=safeHtml(p.content_html||"");
    const ld=document.createElement("script");ld.type="application/ld+json";ld.textContent=JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":p.title||"","description":p.meta_description||p.excerpt||"","datePublished":p.published_at||"","dateModified":p.updated_at||p.published_at||"","mainEntityOfPage":{"@type":"WebPage","@id":canonical},"image":p.featured_image_url?[p.featured_image_url]:[],"author":{"@type":"Organization","name":"Group Travel Airlines"},"publisher":{"@type":"Organization","name":"Group Travel Airlines"}});document.head.appendChild(ld);
  }catch(e){console.error(e);document.getElementById("articleRoot").innerHTML='<div class="error">Unable to load this article.</div>';}
})();
