// SPDX-License-Identifier: MPL-2.0
pub mod layouts;
pub mod modifiers { pub mod common; pub mod constraints; pub mod flex_layout; pub mod grid_layout; }
pub use layouts::*;
use crate::math::Bounds;
use crate::scalar::Matrix;
use crate::uuid::Uuid;

#[derive(Debug, Copy, Clone, PartialEq)]
pub enum ConstraintH { Left, Right, Center, LeftRight, Scale }
#[derive(Debug, Copy, Clone, PartialEq)]
pub enum ConstraintV { Top, Bottom, Center, TopBottom, Scale }
#[derive(Debug)]
pub struct Frame { pub layout:Option<Layout> }
#[derive(Debug)]
pub enum Type { Frame(Frame), Rect }
#[derive(Debug)]
pub struct Shape {
    pub id:Uuid, pub shape_type:Type, pub layout_item:Option<LayoutItem>,
    pub children:Vec<Uuid>, pub geometry:Bounds, pub ignore_constraints:bool, pub invisible:bool,
}
impl Shape {
    pub fn bounds(&self)->Bounds {self.geometry}
    pub fn children_count(&self)->usize {self.children.len()}
    pub fn children_ids_iter(&self,_:bool)->impl Iterator<Item=&Uuid> {self.children.iter().rev()}
    pub fn children_ids_iter_forward(&self,_:bool)->impl Iterator<Item=&Uuid> {self.children.iter()}
    pub fn is_layout_horizontal_auto(&self)->bool {self.layout_item.is_some_and(|i|i.h_sizing==Sizing::Auto)}
    pub fn is_layout_vertical_auto(&self)->bool {self.layout_item.is_some_and(|i|i.v_sizing==Sizing::Auto)}
    pub fn is_layout_horizontal_fill(&self)->bool {self.layout_item.is_some_and(|i|i.h_sizing==Sizing::Fill)}
    pub fn is_layout_vertical_fill(&self)->bool {self.layout_item.is_some_and(|i|i.v_sizing==Sizing::Fill)}
    pub fn is_absolute(&self)->bool {self.layout_item.is_some_and(|i|i.is_absolute)}
    pub fn hidden(&self)->bool {self.invisible}
    pub fn has_layout(&self)->bool {matches!(self.shape_type,Type::Frame(Frame{layout:Some(_)}))}
    pub fn constraint_h(&self, default:ConstraintH)->ConstraintH {default}
    pub fn constraint_v(&self, default:ConstraintV)->ConstraintV {default}
}
pub enum Modifier { Transform(Uuid,Matrix), Reflow(Uuid,bool), Parent(Uuid,Matrix) }
impl Modifier {
    pub fn transform_propagate(id:Uuid,m:Matrix)->Self {Self::Transform(id,m)}
    pub fn reflow(id:Uuid,force:bool)->Self {Self::Reflow(id,force)}
    pub fn parent(id:Uuid,m:Matrix)->Self {Self::Parent(id,m)}
}
