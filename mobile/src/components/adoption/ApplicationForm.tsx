import React,{useState} from 'react';import {Input} from '../ui/Input';import {Button} from '../ui/Button';
export function ApplicationForm({onSubmit,loading}:{onSubmit:(answers:string)=>void;loading?:boolean}){
 const [answers,setAnswers]=useState('');return <><Input label="Your adoption application" value={answers} onChangeText={setAnswers} multiline numberOfLines={5} placeholder="Describe your experience, home environment and care plan"/>
 <Button title="Submit application" disabled={answers.trim().length<20} loading={loading} onPress={()=>onSubmit(answers.trim())}/></>;
}
