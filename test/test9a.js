#!/usr/bin/env node

const ros=require('rosnodejs');
const sensor_msgs=ros.require('sensor_msgs').msg;
const sens=require('../script/ycam1h.js');
const std_msgs=ros.require('std_msgs').msg;
const std_srvs=ros.require('std_srvs').srv;
const rovi_srvs = ros.require('rovi').srv;

ros.Time.diff=function(t0){
	let t1=ros.Time.now();
	t1.secs-=t0.secs;
	t1.nsecs-=t0.nsecs;
	return ros.Time.toSeconds(t1);
}

setImmediate(async function(){
	const rosNode=await ros.initNode('/test9');
	const pub_ct=rosNode.advertise('/test9/data',std_msgs.Float32);
	const msg_ct=new std_msgs.Float32();

	const pub_L=rosNode.advertise('/cam_L/image', sensor_msgs.Image);
	const remap_L=rosNode.serviceClient('/cam_L/remap/do',rovi_srvs.ImageFilter,{persist:true});
	if(! await rosNode.waitForService(remap_L.getService(),2000)){
		ros.log.info('remap_L service not available');
		return;
	}
//	if(! await rosNode.waitForService(remap_R.getService(),2000)){
//		ros.log.info('remap_R service not available');
//		return;
//	}
	const id_L=await rosNode.getParam('/cam_L/ID');
//	const id_R=await rosNode.getParam('/cam_R/ID');
	const ev=sens.start(rosNode,id_L);
	let hook_L=null;
	ev.on('cam_L',async function(img){
		let req=new rovi_srvs.ImageFilter.Request();
		req.img=img;
		let ct=ros.Time.now();
		let res=await remap_L.call(req);
		msg_ct.data=ros.Time.diff(ct);
		if(hook_L==null){
			pub_L.publish(res.img);
			pub_ct.publish(msg_ct);
		}
		else hook_L(res.img);
	});
	const svc_parse=rosNode.advertiseService('/test9/parse',rovi_srvs.dialog,(req,res)=>{
		let cmd=req.hello;
		let lbk=cmd.indexOf('{');
		let obj={};
		if(lbk>0){
			cmd=req.hello.substring(0,lbk).trim();
			obj=JSON.parse(req.hello.substring(lbk));
		}
		ros.log.info('parsed:'+cmd+' arg:'+JSON.stringify(obj));
		switch(cmd){
		case 'stat':
			return new Promise((resolve)=>{
				res.answer='{"camera":'+sens.stat()+'}';
				resolve(true);
			});
		case 'ext':  //external(Line1 or Software) trigger
			sens.set({'TriggerMode':'On'});
			return Promise.resolve(true);
		case 'int':  //internal(hardware) trigger
			sens.set({'TriggerMode':'Off','AcquisitionFrameRate':10.0});
			return Promise.resolve(true);
		case 'scan':
			return new Promise((resolve)=>{
				let wdt=setTimeout(function(){
					resolve(false);
					hook_L=null;
					sens.set({'TriggerMode':'Off','AcquisitionFrameRate':10.0});
				},2000);
				sens.set({'TriggerMode':'On'});
				let imgs_L=new Array();
				hook_L=function(img){
					imgs_L.push(img);
					if(imgs_L.length==13){
						clearTimeout(wdt);
						resolve(true);
						hook_L=null;
						sens.set({'TriggerMode':'Off','AcquisitionFrameRate':10.0});
						res.answer='scan compelete:'+imgs_L.length;
					}
				}
			});
		}
	});
});
