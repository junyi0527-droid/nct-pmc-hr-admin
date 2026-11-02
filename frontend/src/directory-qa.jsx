import React,{useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import {AuthProvider,useAuth} from './contexts/AuthContext'
import {WorkflowProvider} from './contexts/WorkflowContext'
import {ThemeProvider} from './contexts/ThemeContext'
import {ToastProvider} from './contexts/ToastContext'
import MainLayout from './components/layout/MainLayout'
import WorkflowDirectory from './pages/WorkflowDirectory'
import api from './lib/api'
import './index.css'
const titles=['Stationery Purchasing','Office Equipment Purchasing','Purchase Requisition (PR)','Purchase Order (PO)','Quotation Management','Supplier & Contractor Register','Uniform Request','Stock Issue']
const catalog={groups:{purchasing:'Purchasing & Suppliers',inventory:'Uniforms & Inventory'},processes:Object.fromEntries(titles.map((title,index)=>['process'+index,{title,number:index+1,group:index<6?'purchasing':'inventory',steps:Array.from({length:index<6?10:6},()=>({kind:index<6?'approval':'task'}))}]))}
api.defaults.adapter=async(config)=>({config,status:200,statusText:'OK',headers:{},data:config.url.endsWith('/catalog')?catalog:config.url==='/auth/me'?{full_name:'HR Admin',role:'hr_admin'}:[]})
function QA(){const {login}=useAuth();useEffect(()=>{login('isolated-qa',{full_name:'HR Admin',role:'hr_admin',email:'qa@example.com'})},[]);return <Routes><Route element={<MainLayout user={{full_name:'HR Admin',role:'hr_admin',email:'qa@example.com'}} logout={()=>{}}/>}><Route path="*" element={<WorkflowDirectory/>}/></Route></Routes>}
createRoot(document.getElementById('root')).render(<BrowserRouter><ThemeProvider><AuthProvider><ToastProvider><WorkflowProvider><QA/></WorkflowProvider></ToastProvider></AuthProvider></ThemeProvider></BrowserRouter>)
