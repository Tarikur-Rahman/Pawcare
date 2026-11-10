import React from 'react';import {useRoute} from '@react-navigation/native';import {EntityForm} from '../shared/EntityForm';
import {useQueryState} from '../../lib/hooks/useQueryState';import {LoadingSkeleton} from '../../components/ui/LoadingSkeleton';
export default function EditPetScreen(){const route=useRoute<any>(),id=Number(route.params?.id||route.params?.petId||0);
 const query=useQueryState<{name:string;breed?:string}>(id?`/pets/${id}`:'/pets',{enabled:id>0});
 if(id&&query.loading&&!query.data)return <LoadingSkeleton/>;
 return <EntityForm key={`${id}-${query.data?.name||'new'}`} title={id?'Edit pet':'Add a pet'} subtitle="Create a private pet profile." path={id?'/pets/:id':'/pets'} method={id?'PATCH':'POST'}
 fields={id?[{name:'name',label:'Pet name',required:true},{name:'breed',label:'Breed'}]:[
 {name:'name',label:'Pet name',required:true},{name:'species',label:'Species',required:true,placeholder:'DOG or CAT'},
 {name:'breed',label:'Breed'},{name:'sex',label:'Sex',required:true,placeholder:'MALE, FEMALE or UNKNOWN'}]}
 initial={id?{name:query.data?.name||'',breed:query.data?.breed||''}:{}} mapValues={v=>id?{name:v.name,breed:v.breed||null}:{name:v.name,species:v.species.toUpperCase(),breed:v.breed||null,sex:v.sex.toUpperCase()}}/>;
}
