import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function PetsScreen(){return <ResourceList title="My pets" subtitle="Profiles and medical care at a glance." path="/pets" kind="pet" detail="PetDetails" create="EditPet" createLabel="+ Add your pet" emptyText="Add your first pet to start tracking care."/>}
