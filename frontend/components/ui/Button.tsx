 'use client';
import type {ButtonHTMLAttributes} from 'react';
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger';loading?:boolean};
export function Button({variant='primary',loading=false,children,className='',disabled,...rest}:Props){return <button className={`btn btn-${variant} ${className}`} disabled={disabled||loading} {...rest}>{loading?<span className="spinner spinner-sm" aria-hidden="true"/>:null}{children}</button>;}