import React from 'react';import {ResourceList} from '../shared/ResourceList';
export default function AdoptionListScreen(){return <ResourceList title="Find a friend" subtitle="Explore moderated, responsible pet adoptions." kind="adoption" path="/adoptions" detail="AdoptionDetails" create="CreateAdoption" createLabel="+ List a pet for adoption" publicData cacheKey="adoptions"/>}
