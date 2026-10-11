// SPDX-License-Identifier: MPL-2.0
use std::ops::{Add, AddAssign, Mul, Neg, Sub};

#[derive(Debug, Default, Copy, Clone, PartialEq)]
pub struct Point { pub x: f32, pub y: f32 }
pub type Vector = Point;
impl Point {
    pub fn new(x: f32, y: f32) -> Self { Self { x, y } }
    pub fn distance(a: Self, b: Self) -> f32 { (b - a).length() }
    pub fn length(&self) -> f32 { (self.x * self.x + self.y * self.y).sqrt() }
    pub fn normalize(&mut self) -> bool { let n = self.length(); if n == 0.0 { return false; } self.x /= n; self.y /= n; true }
    pub fn scale(&mut self, n: f32) { self.x *= n; self.y *= n; }
    pub fn dot(a: Self, b: Self) -> f32 { a.x * b.x + a.y * b.y }
    pub fn cross(self, b: Self) -> f32 { self.x * b.y - self.y * b.x }
}
impl From<Point> for (f32, f32) { fn from(p: Point) -> Self { (p.x, p.y) } }
impl Add for Point { type Output = Self; fn add(self, p: Self) -> Self { Self::new(self.x+p.x,self.y+p.y) } }
impl Sub for Point { type Output = Self; fn sub(self, p: Self) -> Self { Self::new(self.x-p.x,self.y-p.y) } }
impl Mul<f32> for Point { type Output = Self; fn mul(self, n: f32) -> Self { Self::new(self.x*n,self.y*n) } }
impl Neg for Point { type Output = Self; fn neg(self) -> Self { self * -1.0 } }
impl AddAssign for Point { fn add_assign(&mut self, p: Self) { *self = *self + p; } }

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Matrix(pub [f32; 9]);
impl Default for Matrix { fn default() -> Self { Self([1.,0.,0.,0.,1.,0.,0.,0.,1.]) } }
impl Matrix {
    pub fn new_all(a:f32,b:f32,c:f32,d:f32,e:f32,f:f32,g:f32,h:f32,i:f32) -> Self { Self([a,b,c,d,e,f,g,h,i]) }
    pub fn scale((x,y):(f32,f32)) -> Self { Self([x,0.,0.,0.,y,0.,0.,0.,1.]) }
    pub fn translate(p:Point) -> Self { Self([1.,0.,p.x,0.,1.,p.y,0.,0.,1.]) }
    fn multiply(a:&Self,b:&Self) -> Self { let mut r=[0.;9]; for y in 0..3 { for x in 0..3 { r[y*3+x]=a.0[y*3]*b.0[x]+a.0[y*3+1]*b.0[3+x]+a.0[y*3+2]*b.0[6+x]; } } Self(r) }
    pub fn pre_concat(&mut self, m:&Self) { *self=Self::multiply(self,m); }
    pub fn post_concat(&mut self, m:&Self) { *self=Self::multiply(m,self); }
    pub fn pre_translate(&mut self, p:Point) { self.pre_concat(&Self::translate(p)); }
    pub fn post_translate(&mut self, p:Point) { self.post_concat(&Self::translate(p)); }
    pub fn map_point(&self, p:Point) -> Point { let m=&self.0; let w=m[6]*p.x+m[7]*p.y+m[8]; Point::new((m[0]*p.x+m[1]*p.y+m[2])/w,(m[3]*p.x+m[4]*p.y+m[5])/w) }
    pub fn map_points(&self, dst:&mut [Point], src:&[Point]) { for (a,b) in dst.iter_mut().zip(src) { *a=self.map_point(*b); } }
    pub fn invert(&self) -> Option<Self> {
        let [a,b,c,d,e,f,g,h,i]=self.0;
        let det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
        if !det.is_finite() || det.abs()<1e-12 { return None; }
        Some(Self([(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det,(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det,(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]))
    }
    pub fn scale_x(&self)->f32 {self.0[0]} pub fn scale_y(&self)->f32 {self.0[4]}
    pub fn skew_x(&self)->f32 {self.0[1]} pub fn skew_y(&self)->f32 {self.0[3]}
    pub fn translate_x(&self)->f32 {self.0[2]} pub fn translate_y(&self)->f32 {self.0[5]}
    pub fn set_translate_x(&mut self,n:f32) {self.0[2]=n;} pub fn set_translate_y(&mut self,n:f32) {self.0[5]=n;}
}

pub struct Rect { pub left:f32,pub top:f32,pub right:f32,pub bottom:f32 }
impl Rect {
    pub fn new(left:f32,top:f32,right:f32,bottom:f32)->Self {Self{left,top,right,bottom}}
    pub fn from_ltrb(left:f32,top:f32,right:f32,bottom:f32)->Self { Self::new(left,top,right,bottom) }
    pub fn to_quad(&self,_:Option<&Matrix>)->[Point;4] {[Point::new(self.left,self.top),Point::new(self.right,self.top),Point::new(self.right,self.bottom),Point::new(self.left,self.bottom)]}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn skia_pre_and_post_concatenation_order() {
        // SkMatrix preConcat=M*other and postConcat=other*M.
        let scale=Matrix::scale((2.,3.));
        let translation=Matrix::translate(Point::new(5.,7.));
        let mut pre=scale; pre.pre_concat(&translation);
        let mut post=scale; post.post_concat(&translation);
        assert_eq!(pre.map_point(Point::new(1.,2.)),Point::new(12.,27.));
        assert_eq!(post.map_point(Point::new(1.,2.)),Point::new(7.,13.));
    }
    #[test]
    fn inversion_and_mapped_points_keep_affine_axes() {
        let matrix=Matrix::new_all(0.,-2.,10.,3.,0.,20.,0.,0.,1.);
        let points=[Point::new(1.,2.),Point::new(-4.,3.)];
        let mut mapped=[Point::default();2]; matrix.map_points(&mut mapped,&points);
        assert_eq!(mapped,[Point::new(6.,23.),Point::new(4.,8.)]);
        let inverse=matrix.invert().unwrap();
        for (point,mapped) in points.into_iter().zip(mapped) {
            let recovered=inverse.map_point(mapped);
            assert!((recovered.x-point.x).abs()<1e-6);
            assert!((recovered.y-point.y).abs()<1e-6);
        }
        assert!(Matrix::scale((0.,1.)).invert().is_none());
    }
    #[test]
    fn vector_and_rect_conventions() {
        let mut v=Point::new(3.,4.); assert_eq!(v.length(),5.); assert!(v.normalize());
        assert_eq!(v,Point::new(0.6,0.8));
        assert_eq!(Point::new(1.,0.).cross(Point::new(0.,1.)),1.);
        assert_eq!(Rect::new(1.,2.,4.,8.).to_quad(None),[Point::new(1.,2.),Point::new(4.,2.),Point::new(4.,8.),Point::new(1.,8.)]);
    }
}
