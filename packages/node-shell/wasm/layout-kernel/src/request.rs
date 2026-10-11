// SPDX-License-Identifier: MPL-2.0
use std::collections::HashMap;
use serde::{Deserialize,Serialize};
use crate::{math::Bounds, scalar::Point, shapes::*};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    mode:String, direction:String, wrap:bool, bounds:[f32;8], padding:[f32;4], gap:[f32;2],
    align:String, align_content:String, justify:String, justify_items:String,
    sizing:[String;2], items:Vec<Item>, columns:Vec<Track>, rows:Vec<Track>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Item {
    bounds:[f32;8], sizing:[String;2], margin:[f32;4], min:[Option<f32>;2], max:[Option<f32>;2],
    absolute:bool, hidden:bool, align:String, justify:String, cell:[usize;4],
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Track { kind:String, value:f32 }
#[derive(Serialize)]
struct Output {
    bounds:Vec<[f32;8]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    columns:Option<Vec<[f32;5]>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rows:Option<Vec<[f32;5]>>,
}
fn bounds(b:[f32;8])->Bounds {Bounds::new(Point::new(b[0],b[1]),Point::new(b[2],b[3]),Point::new(b[4],b[5]),Point::new(b[6],b[7]))}
fn points(b:Bounds)->[f32;8] {[b.nw.x,b.nw.y,b.ne.x,b.ne.y,b.se.x,b.se.y,b.sw.x,b.sw.y]}
fn sizing(s:&str)->Result<Sizing,String> {match s {"fixed"=>Ok(Sizing::Fix),"hug"=>Ok(Sizing::Auto),"fill"=>Ok(Sizing::Fill),_=>Err("Unknown sizing mode.".into())}}
fn align(s:&str)->Result<AlignItems,String> {match s {"start"=>Ok(AlignItems::Start),"center"=>Ok(AlignItems::Center),"end"=>Ok(AlignItems::End),"stretch"=>Ok(AlignItems::Stretch),_=>Err("Unknown item alignment.".into())}}
fn content(s:&str)->Result<AlignContent,String> {match s {"start"=>Ok(AlignContent::Start),"center"=>Ok(AlignContent::Center),"end"=>Ok(AlignContent::End),"stretch"=>Ok(AlignContent::Stretch),"space-between"=>Ok(AlignContent::SpaceBetween),"space-around"=>Ok(AlignContent::SpaceAround),"space-evenly"=>Ok(AlignContent::SpaceEvenly),_=>Err("Unknown content alignment.".into())}}
fn justify(s:&str)->Result<JustifyContent,String> {match s {"start"=>Ok(JustifyContent::Start),"center"=>Ok(JustifyContent::Center),"end"=>Ok(JustifyContent::End),"stretch"=>Ok(JustifyContent::Stretch),"space-between"=>Ok(JustifyContent::SpaceBetween),"space-around"=>Ok(JustifyContent::SpaceAround),"space-evenly"=>Ok(JustifyContent::SpaceEvenly),_=>Err("Unknown content distribution.".into())}}
fn align_self(s:&str)->Result<Option<AlignSelf>,String> {Ok(match s {"auto"=>None,"start"=>Some(AlignSelf::Start),"center"=>Some(AlignSelf::Center),"end"=>Some(AlignSelf::End),"stretch"=>Some(AlignSelf::Stretch),_=>return Err("Unknown self alignment.".into())})}
fn justify_self(s:&str)->Result<Option<JustifySelf>,String> {Ok(match s {"auto"=>None,"start"=>Some(JustifySelf::Start),"center"=>Some(JustifySelf::Center),"end"=>Some(JustifySelf::End),"stretch"=>Some(JustifySelf::Stretch),_=>return Err("Unknown self distribution.".into())})}
fn item(i:&Item)->Result<LayoutItem,String> {
    Ok(LayoutItem{margin_top:i.margin[0],margin_right:i.margin[1],margin_bottom:i.margin[2],margin_left:i.margin[3],h_sizing:sizing(&i.sizing[0])?,v_sizing:sizing(&i.sizing[1])?,min_w:i.min[0],min_h:i.min[1],max_w:i.max[0],max_h:i.max[1],is_absolute:i.absolute,z_index:None,align_self:align_self(&i.align)?})
}
fn tracks(input:&[Track])->Result<Vec<GridTrack>,String> {
    input.iter().map(|t| {if !t.value.is_finite() || t.value<0. || t.value>1e7 || (t.kind=="fr" && t.value==0.) {return Err("Track value must be finite and nonnegative.".into());}
        Ok(GridTrack{track_type:match t.kind.as_str(){"fixed"=>GridTrackType::Fixed,"percent"=>GridTrackType::Percent,"fr"=>GridTrackType::Flex,"auto"=>GridTrackType::Auto,_=>return Err("Unknown track type.".into())},value:t.value})}).collect()
}
fn validate(r:&Request)->Result<(),String> {
    if r.items.len()>20000 || r.rows.len()>1024 || r.columns.len()>1024 {return Err("Layout exceeds its item or track limit.".into());}
    if r.bounds.iter().chain(r.padding.iter()).chain(r.gap.iter()).any(|n|!n.is_finite() || n.abs()>1e7) || r.padding.iter().chain(r.gap.iter()).any(|n|*n<0.) {return Err("Invalid layout dimensions or spacing.".into());}
    if bounds(r.bounds).width()<0.01 || bounds(r.bounds).height()<0.01 {return Err("Container dimensions must be positive.".into());}
    if r.mode=="grid" {
        if r.rows.is_empty() || r.columns.is_empty() {return Err("Grid needs row and column tracks.".into());}
        if r.rows.len().saturating_mul(r.columns.len())>65536 {return Err("Grid exceeds its 65,536 cell limit.".into());}
        let work=r.items.iter().filter(|i|!i.absolute && !i.hidden).try_fold(0usize,|sum,i|sum.checked_add(i.cell[2]).and_then(|n|n.checked_add(i.cell[3])));
        if work.is_none_or(|n|n>262144) {return Err("Grid exceeds its span work limit.".into());}
    }
    for i in &r.items {
        if i.bounds.iter().chain(i.margin.iter()).any(|n|!n.is_finite() || n.abs()>1e7) {return Err("Invalid item geometry.".into());}
        for axis in 0..2 {if i.min[axis].into_iter().chain(i.max[axis]).any(|n|!n.is_finite() || n<0.) || i.min[axis].unwrap_or(0.)>i.max[axis].unwrap_or(f32::MAX) {return Err("Invalid item size limits.".into());}}
        if r.mode=="grid" && !i.absolute && !i.hidden && (i.cell[0]==0 || i.cell[1]==0 || i.cell[2]==0 || i.cell[3]==0 || i.cell.iter().any(|n|*n>1024) || i.cell[0].saturating_add(i.cell[2])-1>r.rows.len() || i.cell[1].saturating_add(i.cell[3])-1>r.columns.len()) {return Err("Grid cell is outside the declared tracks.".into());}
    }
    Ok(())
}
pub fn solve(bytes:&[u8])->Result<Vec<u8>,String> {
    crate::work::reset();
    let r:Request=serde_json::from_slice(bytes).map_err(|e|e.to_string())?;
    validate(&r)?;
    let layout=LayoutData{align_items:align(&r.align)?,align_content:content(&r.align_content)?,justify_items:match align(&r.justify_items)?{AlignItems::Start=>JustifyItems::Start,AlignItems::Center=>JustifyItems::Center,AlignItems::End=>JustifyItems::End,AlignItems::Stretch=>JustifyItems::Stretch},justify_content:justify(&r.justify)?,padding_top:r.padding[0],padding_right:r.padding[1],padding_bottom:r.padding[2],padding_left:r.padding[3],row_gap:r.gap[0],column_gap:r.gap[1]};
    let layout=match r.mode.as_str() {
        "flex"=>Layout::FlexLayout(layout,FlexData{direction:match r.direction.as_str(){"row"=>FlexDirection::Row,"row-reverse"=>FlexDirection::RowReverse,"column"=>FlexDirection::Column,"column-reverse"=>FlexDirection::ColumnReverse,_=>return Err("Unknown flex direction.".into())},wrap_type:if r.wrap{WrapType::Wrap}else{WrapType::NoWrap}}),
        "grid"=>Layout::GridLayout(layout,GridData{direction:match r.direction.as_str(){"row"=>GridDirection::Row,"column"=>GridDirection::Column,_=>return Err("Unknown grid direction.".into())},columns:tracks(&r.columns)?,rows:tracks(&r.rows)?,cells:r.items.iter().enumerate().filter(|(_,i)|!i.absolute && !i.hidden).map(|(n,i)|Ok(GridCell{row:i.cell[0] as i32,column:i.cell[1] as i32,row_span:i.cell[2] as i32,column_span:i.cell[3] as i32,align_self:align_self(&i.align)?,justify_self:justify_self(&i.justify)?,shape:Some(n as u32+1)})).collect::<Result<Vec<_>,String>>()?}),
        _=>return Err("Unknown layout mode.".into()),
    };
    let root=Shape{id:0,shape_type:Type::Frame(Frame{layout:Some(layout.clone())}),layout_item:Some(LayoutItem{margin_top:0.,margin_right:0.,margin_bottom:0.,margin_left:0.,h_sizing:sizing(&r.sizing[0])?,v_sizing:sizing(&r.sizing[1])?,max_h:None,min_h:None,max_w:None,min_w:None,is_absolute:false,z_index:None,align_self:None}),children:(1..=r.items.len() as u32).rev().collect(),geometry:bounds(r.bounds),ignore_constraints:false,invisible:false};
    let mut pool=HashMap::new();
    for (n,i) in r.items.iter().enumerate() {pool.insert(n as u32+1,Shape{id:n as u32+1,shape_type:Type::Rect,layout_item:Some(item(i)?),children:vec![],geometry:bounds(i.bounds),ignore_constraints:false,invisible:i.hidden});}
    pool.insert(0,root);
    let mut result=HashMap::new();
    let root=pool.get(&0).unwrap();
    let modifiers=match &layout {Layout::FlexLayout(d,f)=>modifiers::flex_layout::reflow_flex_layout(root,d,f,&pool,&mut result),Layout::GridLayout(d,g)=>modifiers::grid_layout::reflow_grid_layout(root,d,g,&pool,&mut result)}.map_err(|e|format!("{e:?}"))?;
    crate::work::check()?;
    for m in modifiers {if let Modifier::Transform(id,m)=m {let b=result.get(&id).copied().unwrap_or(pool[&id].geometry);result.insert(id,b.transform(&m));}}
    // Calculate overlays from the same request bounds and authored child sizes used by reflow.
    let (columns,rows)=if let Layout::GridLayout(d,g)=&layout {
        let input_bounds=HashMap::new();
        let collect=|columns| modifiers::grid_layout::calculate_tracks(columns,root,d,g,&root.geometry,&g.cells,&pool,&input_bounds).into_iter().map(|t|[t.anchor_start.x,t.anchor_start.y,t.anchor_end.x,t.anchor_end.y,t.size]).collect();
        (Some(collect(true)),Some(collect(false)))
    }else{(None,None)};
    crate::work::check()?;
    let output=Output{columns,rows,bounds:(0..=r.items.len() as u32).map(|id|points(result.get(&id).copied().unwrap_or(pool[&id].geometry))).collect()};
    if output.bounds.iter().flatten().chain(output.columns.iter().flatten().flatten()).chain(output.rows.iter().flatten().flatten()).any(|n|!n.is_finite()) {return Err("Layout produced nonfinite geometry.".into());}
    serde_json::to_vec(&output).map_err(|e|e.to_string())
}
