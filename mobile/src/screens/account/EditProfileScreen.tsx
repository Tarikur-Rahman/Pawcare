import React from 'react';import {EntityForm} from '../shared/EntityForm';import {useAuth} from '../../lib/auth/AuthContext';
export default function EditProfileScreen(){const {user}=useAuth();return <EntityForm title="Edit profile" path="/users/me" method="PATCH" fields={[
 {name:'displayName',label:'Name',required:true},{name:'timeZone',label:'Time zone',required:true,placeholder:'Asia/Dhaka'},
 {name:'locale',label:'Locale',required:true,placeholder:'en-BD'}]} initial={{displayName:user?.displayName||'',timeZone:'Asia/Dhaka',locale:'en-BD'}}/>;}
