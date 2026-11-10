import React from 'react';import {ActivityIndicator,Text,View} from 'react-native';
import {NavigationContainer,DefaultTheme} from '@react-navigation/native';import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../lib/auth/AuthContext';import {OwnerTabs} from './OwnerTabs';import {VetNavigator} from './VetNavigator';import {AdminNavigator} from './AdminNavigator';
import {t} from '../lib/theme/tokens';
import LoginScreen from '../screens/auth/LoginScreen';import RegisterScreen from '../screens/auth/RegisterScreen';import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ExploreScreen from '../screens/explore/ExploreScreen';
import AdoptionList from '../screens/adoption/AdoptionListScreen';
import AdoptionDetails from '../screens/adoption/AdoptionDetailsScreen';
import CreateAdoption from '../screens/adoption/CreateAdoptionScreen';
import MyApplications from '../screens/adoption/MyApplicationsScreen';
import Marketplace from '../screens/marketplace/MarketplaceScreen';
import SaleDetails from '../screens/marketplace/SaleDetailsScreen';
import CreateSaleListing from '../screens/marketplace/CreateSaleListingScreen';
import MySaleListings from '../screens/marketplace/MySaleListingsScreen';
import LostFound from '../screens/lostfound/LostFoundScreen';
import LostReportDetails from '../screens/lostfound/LostReportDetailsScreen';
import CreateLostReport from '../screens/lostfound/CreateLostReportScreen';
import Sighting from '../screens/lostfound/SightingScreen';
import FoodStore from '../screens/shop/FoodStoreScreen';
import ProductDetails from '../screens/shop/ProductDetailsScreen';
import Cart from '../screens/shop/CartScreen';
import Checkout from '../screens/shop/CheckoutScreen';
import Orders from '../screens/shop/OrdersScreen';
import OrderDetails from '../screens/shop/OrderDetailsScreen';
import PetDetails from '../screens/pets/PetDetailsScreen';
import EditPet from '../screens/pets/EditPetScreen';
import HealthTimeline from '../screens/pets/HealthTimelineScreen';
import Notifications from '../screens/home/NotificationsScreen';
import ReminderSettings from '../screens/care/ReminderSettingsScreen';
import TaskEditor from '../screens/care/TaskEditorScreen';
import Visits from '../screens/visits/VisitsScreen';
import VetDirectory from '../screens/visits/VetDirectoryScreen';
import BookVisit from '../screens/visits/BookVisitScreen';
import Expenses from '../screens/expenses/ExpensesScreen';
import EditProfile from '../screens/account/EditProfileScreen';
import Settings from '../screens/account/SettingsScreen';
import Care from '../screens/care/CareScreen';
import Addresses from '../screens/account/AddressesScreen';
const Stack=createNativeStackNavigator();
const theme={...DefaultTheme,colors:{...DefaultTheme.colors,background:t.bg,primary:t.brand,card:t.paper,text:t.ink,border:t.border}};
export function RootNavigator(){const {user,loading}=useAuth();if(loading)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:t.bg}}><ActivityIndicator color={t.brand}/><Text style={{color:t.muted,marginTop:14}}>Opening PawCare…</Text></View>;
 return <NavigationContainer theme={theme}><Stack.Navigator key={user?.role||'guest'} screenOptions={{headerShown:false}}>
 {!user?<>
 <Stack.Screen name="Login" component={LoginScreen}/><Stack.Screen name="Register" component={RegisterScreen}/><Stack.Screen name="ResetPassword" component={ResetPasswordScreen}/>
 <Stack.Screen name="ExploreGuest" component={ExploreScreen}/>
 </>:<>
 {user.role==='ADMIN'?<Stack.Screen name="AdminRoot" component={AdminNavigator}/>:user.role==='VET'?<Stack.Screen name="VetRoot" component={VetNavigator}/>:<Stack.Screen name="OwnerRoot" component={OwnerTabs}/>}
 <Stack.Screen name="CreateAdoption" component={CreateAdoption}/>
<Stack.Screen name="MyApplications" component={MyApplications}/>
<Stack.Screen name="CreateSaleListing" component={CreateSaleListing}/>
<Stack.Screen name="MySaleListings" component={MySaleListings}/>
<Stack.Screen name="CreateLostReport" component={CreateLostReport}/>
<Stack.Screen name="Sighting" component={Sighting}/>
<Stack.Screen name="Cart" component={Cart}/>
<Stack.Screen name="Checkout" component={Checkout}/>
<Stack.Screen name="Orders" component={Orders}/>
<Stack.Screen name="OrderDetails" component={OrderDetails}/>
<Stack.Screen name="PetDetails" component={PetDetails}/>
<Stack.Screen name="EditPet" component={EditPet}/>
<Stack.Screen name="HealthTimeline" component={HealthTimeline}/>
<Stack.Screen name="Notifications" component={Notifications}/>
<Stack.Screen name="ReminderSettings" component={ReminderSettings}/>
<Stack.Screen name="TaskEditor" component={TaskEditor}/>
<Stack.Screen name="Visits" component={Visits}/>
<Stack.Screen name="VetDirectory" component={VetDirectory}/>
<Stack.Screen name="BookVisit" component={BookVisit}/>
<Stack.Screen name="Expenses" component={Expenses}/>
<Stack.Screen name="EditProfile" component={EditProfile}/>
<Stack.Screen name="Addresses" component={Addresses}/>
<Stack.Screen name="Settings" component={Settings}/>
<Stack.Screen name="Care" component={Care}/>
 </>}
 <Stack.Screen name="AdoptionList" component={AdoptionList}/>
<Stack.Screen name="AdoptionDetails" component={AdoptionDetails}/>
<Stack.Screen name="Marketplace" component={Marketplace}/>
<Stack.Screen name="SaleDetails" component={SaleDetails}/>
<Stack.Screen name="LostFound" component={LostFound}/>
<Stack.Screen name="LostReportDetails" component={LostReportDetails}/>
<Stack.Screen name="FoodStore" component={FoodStore}/>
<Stack.Screen name="ProductDetails" component={ProductDetails}/>
 </Stack.Navigator></NavigationContainer>
}
