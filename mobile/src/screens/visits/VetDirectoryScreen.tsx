import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function VetDirectoryScreen(){return <ResourceList title="Veterinarians" subtitle="Available registered veterinarians." path="/vets" publicData create="BookVisit" createLabel="Book appointment"/>}
