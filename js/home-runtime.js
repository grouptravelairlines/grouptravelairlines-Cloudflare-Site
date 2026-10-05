import { supabase } from "/js/supabase-client.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

const defaults = {
  settings: {
    phone: "1-888-928-7796",
    email: "info@grouptravelairlines.com",
    quote_url: "https://www.grouptravelairlines.com/",
    homepage_seo_title: "Group Travel Airlines | Finalize Your Group Travel",
    homepage_meta_description: "Group Travel Airlines provides practical group flight information, travel guides, destination inspiration and airline insights for families, teams, schools and business groups.",
    homepage_og_description: "Group flight information, practical travel advice and helpful guides for planning group journeys."
  },
  homepage: {
    header:{homeLabel:"Home",blogLabel:"Blog",callLabel:"Call Us"},
    hero:{eyebrow:"Group flight travel made easy",title:"Finalize Your",highlight:"Group Travel",description:"Expert tips, airline information and travel guidance to help you plan the perfect group trip.",microCopy:"Get the best group flight options on our main website.",imageUrl:"/assets/hero-group-travel.jpg",imageAlt:"Group of travelers preparing to board an airplane"},
    trust:[
      {title:"Group Travel Information",text:"Guides, requirements and useful tips"},
      {title:"Practical Travel Advice",text:"Easy-to-read articles for every trip"},
      {title:"Plan Smarter",text:"Make informed decisions for your group"},
      {title:"Trusted Information",text:"Reliable and up-to-date travel content"}
    ],
    destinations:{kicker:"Popular group destinations",title:"Top Destinations for Group Travel",description:"Discover inspiring places perfect for family trips, corporate travel, student groups and more.",viewAllLabel:"View All Destinations →",items:[
      {name:"Europe",description:"Timeless cities and rich cultures",imageUrl:"/assets/dest-europe.jpg",alt:"Europe group travel destination"},
      {name:"Asia",description:"Incredible experiences",imageUrl:"/assets/dest-asia.jpg",alt:"Asia group travel destination"},
      {name:"North America",description:"Iconic landscapes and adventures",imageUrl:"/assets/dest-north-america.jpg",alt:"North America group travel destination"},
      {name:"Island Getaways",description:"Relaxing escapes for groups",imageUrl:"/assets/dest-island.jpg",alt:"Island group travel destination"},
      {name:"More Destinations",description:"Explore all inspiring places",imageUrl:"/assets/dest-more.jpg",alt:"Additional group travel destinations"}
    ]},
    betterTogether:{kicker:"Why Group Travel Airlines",title:"Travel Better,",title2:"Together",description:"Useful information, expert guidance and practical tips to make group travel simpler, more affordable and stress-free.",imageUrl:"/assets/why-travel.jpg",imageAlt:"Group of travelers enjoying a destination together",benefits:[
      {icon:"✈",title:"Airline Information"},{icon:"◉",title:"Group Travel Tips"},{icon:"✦",title:"Planning Guides"},{icon:"▤",title:"Latest Updates"}
    ]},
    blogSection:{kicker:"Latest from our blog",title:"Travel Insights & Helpful Guides",description:"Explore our latest articles with practical tips, airline information and group travel advice.",viewAllLabel:"View All Articles →"},
    smarter:{kicker:"Travel smarter",title:"Group travel made easier.",description:"Build better group travel plans with clear information, practical guides and a reliable starting point for your research.",backgroundImageUrl:"/assets/travel-smarter.jpg",cards:[
      {num:"01 / Research",title:"Understand group flight options",text:"Learn how group reservations work, what airlines may require and what information is useful before requesting a quote."},
      {num:"02 / Organize",title:"Prepare your travel details",text:"Use practical checklists and planning guidance to keep dates, traveler counts and trip requirements organized."},
      {num:"03 / Finalize",title:"Take the next step with confidence",text:"When your plan is ready, request group travel assistance directly through the main Group Travel Airlines website."}
    ]},
    cta:{kicker:"Ready to plan?",title:"Finalize your group travel.",description:"For quotes, booking support and direct group travel assistance, continue to the main Group Travel Airlines website.",buttonLabel:"Request a Quote →"},
    footer:{description:"Practical travel information for groups, families, teams and business travelers.",copyright:"© 2026 Group Travel Airlines. All rights reserved."}
  }
};

function get(obj,path, fallback="") { return path.split(".").reduce((a,k)=>a?.[k], obj) ?? fallback; }
function setText(path,value){ $$(`[data-cms="${CSS.escape(path)}"]`).forEach(el=>el.textContent=value ?? ""); }
function setHref(path,value){
  $$(`[data-cms-href="${CSS.escape(path)}"]`).forEach(el=>{
    if(path==="settings.phone") el.href=`tel:+${String(value||"").replace(/\D/g,"")}`;
    else if(path==="settings.email") el.href=`mailto:${value||""}`;
    else el.href=value||"#";
  });
}
function setSrc(path,value,altPath,dataObj){
  $$(`[data-cms-src="${CSS.escape(path)}"]`).forEach(img=>{if(value)img.src=value;});
  if(altPath) $$(`[data-cms-alt="${CSS.escape(altPath)}"]`).forEach(img=>img.alt=get(dataObj,altPath,""));
}

function apply(siteSettings, homepage) {
  const s=siteSettings||defaults.settings, h=homepage||defaults.homepage;
  setText("header.homeLabel",get(h,"header.homeLabel"));
  setText("header.blogLabel",get(h,"header.blogLabel"));
  setText("header.callLabel",get(h,"header.callLabel"));
  setHref("settings.phone",get(s,"phone"));
  setText("hero.eyebrow",get(h,"hero.eyebrow"));
  setText("hero.title",get(h,"hero.title"));
  setText("hero.highlight",get(h,"hero.highlight"));
  setText("hero.description",get(h,"hero.description"));
  setText("hero.microCopy",get(h,"hero.microCopy"));
  setSrc("hero.imageUrl",get(h,"hero.imageUrl"),"hero.imageAlt",h);
  setHref("settings.quoteUrl",get(s,"quote_url"));
  const trust=get(h,"trust",[]); trust.forEach((x,i)=>{setText(`trust.${i}.title`,x.title);setText(`trust.${i}.text`,x.text);});
  const d=get(h,"destinations",{}); setText("destinations.kicker",d.kicker);setText("destinations.title",d.title);setText("destinations.description",d.description);setText("destinations.viewAllLabel",d.viewAllLabel);setHref("settings.quoteUrl",get(s,"quote_url"));
  (d.items||[]).forEach((x,i)=>{setText(`destinations.items.${i}.name`,x.name);setText(`destinations.items.${i}.description`,x.description);setSrc(`destinations.items.${i}.imageUrl`,x.imageUrl,`destinations.items.${i}.alt`,h);});
  const bt=get(h,"betterTogether",{});setText("betterTogether.kicker",bt.kicker);setText("betterTogether.title",bt.title);setText("betterTogether.title2",bt.title2);setText("betterTogether.description",bt.description);setSrc("betterTogether.imageUrl",bt.imageUrl,"betterTogether.imageAlt",h);(bt.benefits||[]).forEach((x,i)=>{setText(`betterTogether.benefits.${i}.icon`,x.icon);setText(`betterTogether.benefits.${i}.title`,x.title);});
  const bs=get(h,"blogSection",{});setText("blogSection.kicker",bs.kicker);setText("blogSection.title",bs.title);setText("blogSection.description",bs.description);setText("blogSection.viewAllLabel",bs.viewAllLabel);
  const sm=get(h,"smarter",{});setText("smarter.kicker",sm.kicker);setText("smarter.title",sm.title);setText("smarter.description",sm.description);(sm.cards||[]).forEach((x,i)=>{setText(`smarter.cards.${i}.num`,x.num);setText(`smarter.cards.${i}.title`,x.title);setText(`smarter.cards.${i}.text`,x.text);});
  const dark=$(".dark-section"); if(dark&&sm.backgroundImageUrl) dark.style.setProperty("--cms-smarter-bg",`url("${sm.backgroundImageUrl.replace(/"/g,'')}" )`);
  const c=get(h,"cta",{});setText("cta.kicker",c.kicker);setText("cta.title",c.title);setText("cta.description",c.description);setText("cta.buttonLabel",c.buttonLabel);
  const f=get(h,"footer",{});setText("footer.description",f.description);setText("footer.copyright",f.copyright);setText("settings.phone",get(s,"phone"));setText("settings.email",get(s,"email"));setHref("settings.email",get(s,"email"));setHref("settings.quoteUrl",get(s,"quote_url"));
  document.title=s.homepage_seo_title||document.title;
  const meta=$("meta[name='description']");if(meta)meta.content=s.homepage_meta_description||meta.content;
  const og=$("meta[property='og:description']");if(og)og.content=s.homepage_og_description||og.content;
  const ogUrl=$("meta[property='og:url']");if(ogUrl)ogUrl.content=location.origin+"/";
}

async function loadBlogPreview(){
  const section=$("#blog-preview"), grid=$("#latestArticles"), empty=$("#blogEmpty");
  const {data,error}=await supabase.from("blog_posts").select("id,title,slug,excerpt,featured_image_url,image_alt,published,published_at,display_date,featured_on_homepage").eq("published",true).eq("featured_on_homepage",true).order("published_at",{ascending:false}).limit(3);
  if(error||!data?.length){section.hidden=true;return;}
  grid.innerHTML=data.map(p=>`<article class="blog-card"><img src="${esc(p.featured_image_url||"/assets/blog-default.jpg")}" alt="${esc(p.image_alt||p.title||"")}"><div class="blog-body"><div class="blog-date">${esc(p.display_date||new Date(p.published_at||Date.now()).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}))}</div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt||"")}</p><a class="read-link" href="/blog/${encodeURIComponent(String(p.slug).replace(/^\/+|\/+$/g, ""))}">Read More →</a></div></article>`).join("");
  empty.style.display="none";section.hidden=false;
}

(async()=>{
  try{
    const [{data:s,error:se},{data:h,error:he}]=await Promise.all([
      supabase.from("site_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("homepage_content").select("content").eq("id",1).maybeSingle()
    ]);

    if(se) throw se;
    if(he) throw he;

    apply(s||defaults.settings,h?.content||defaults.homepage);

    await loadBlogPreview();

    document.body.classList.add("cms-ready");
  }catch(err){
    console.warn("CMS load failed; static homepage retained.",err);

    document.body.classList.add("cms-ready");
  }
})();
