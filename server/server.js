import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "node:path";
import {fileURLToPath} from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(__dirname,".."),app=express(),PORT=process.env.PORT||3000;
app.disable("x-powered-by"); app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false})); app.use(compression()); app.use(express.json({limit:"1mb"})); app.use("/api",rateLimit({windowMs:900000,max:200}));
app.get("/api/health",(_q,r)=>r.json({ok:true,service:"RENOBVA Backend"})); app.use(express.static(path.join(root,"public"),{extensions:["html"]})); app.get("/",(_q,r)=>r.sendFile(path.join(root,"public","index.html"))); app.listen(PORT,()=>console.log(`RENOBVA running at http://localhost:${PORT}`));
