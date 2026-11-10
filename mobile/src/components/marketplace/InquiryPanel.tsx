import React,{useState} from 'react';import {Input} from '../ui/Input';import {Button} from '../ui/Button';
export function InquiryPanel({onSubmit,loading}:{onSubmit:(message:string)=>void;loading?:boolean}){
 const [message,setMessage]=useState('');return <><Input label="Private inquiry" value={message} onChangeText={setMessage} multiline placeholder="Ask about veterinary records, welfare and meeting options"/>
 <Button title="Send inquiry" disabled={message.trim().length<10} loading={loading} onPress={()=>onSubmit(message.trim())}/></>;
}
