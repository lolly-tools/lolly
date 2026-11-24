# Lolly Design: 자유 캔버스

<a id="design-the-free-canvas"></a>

Lolly Design은 템플릿으로 만들 수 없는 레이아웃을 위한 도구예요. 처음부터 만든 포스터, 슬라이드 덱, 사운드트랙을 넣은 모션 작품 등이 여기에 해당해요. 캔버스의 박스를 끌고, 크기를 바꾸고, 회전하고, 안에 텍스트를 입력해요. 캔버스는 다른 모든 도구와 동일한 렌더 경로를 통해 내보내져요.

저장과 공유처럼 모든 도구에 공통으로 적용되는 기능은 [Lolly 사용하기](/info/using.html)에서 설명해요.

![Lolly Design의 자유 캔버스 - 아트보드와 둘레의 페이스트보드](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

<!--i:eti-grid-->
## Design 창

화면의 **상단 막대**는 **Home**, **File menu**, 문서 이름으로 시작해요(이름을 클릭해서 문서 이름을 바꿔요). 중앙에는 **Undo**, **Redo**, **History**, 확대/축소 컨트롤(**Fit all**, **Fit artboard** 포함)과 **Timeline**, **Navigator**, **Inspector** 토글이 있어요. 오른쪽에는 **Share**, **Present**, **Export**가 배치돼요. 휴대폰에서는 사용 빈도가 낮은 버튼이 **More actions** 안으로 들어가요.

측면의 **도구 레일**에는 Lolly 메뉴와 그리기 도구가 배치돼요. **Pointer**, **Add a box**, **Pen**(**Pencil**과 버튼을 공유해요), **Edit points**, **Line**에 이어 Timeline, Artboards, Auto-arrange 버튼이 있어요.

![자유 캔버스의 도구 레일: 끌기 손잡이와 Lolly 메뉴 다음에 Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards, Auto-arrange가 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

캔버스는 아트보드 둘레의 디자이너용 페이스트보드처럼 쓸 수 있어요.

- **박스를 아트보드 밖에 놓아두세요.** 박스를 프레임 가장자리 밖으로 끌어도 여전히 보이고 선택할 수 있어요. 프레임 밖의 모든 것은 흐리게 표시되고, 프레임의 그림자가 파일이 시작되는 위치를 알려줘요.
- **내보내기에는 아트보드만 포함돼요.** 가장자리 밖으로 나간 박스 부분을 비롯해 프레임 밖의 모든 것은 래스터와 벡터 출력에서 잘려요.
- **Fit보다 더 축소**하면 밖에 놓아둔 모든 것을 볼 수 있어요.
- 내보내기 크기를 바꿔 **아트보드의 크기를 조정**하세요. 박스 위치가 유지되므로 기존 콘텐츠를 기준으로 레이아웃의 프레임을 다시 정할 수 있어요. 박스는 같은 위치에 남아요.

![편집 스테이지: 정면 중앙에 아트보드, 왼쪽에 도구 레일, 모서리에 확대/축소 HUD가 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator와 Inspector

아트보드는 **Navigator**에 **Layers**를 접고 펼칠 수 있는 그룹으로 모두 나열돼요(제목은 **Artboards**이고 덱에서는 **Slides**예요). 아트보드 이름을 선택하면 해당 위치로 이동하고, 아트보드를 펼치면 그 레이어를 선택하거나 순서를 조정할 수 있어요. 화살표 키로 목록 안을 이동하고, Left를 누르면 아트보드 제목으로 돌아와요. **Pages**는 아트보드들을 이름이 있는 페이지로 묶어요. 페이지를 선택해도 편집기에 표시되는 아트보드만 바뀌어요.

선택한 개체의 텍스트 또는 이미지 컨트롤은 **Inspector** 맨 위에 표시돼요. 자주 고르는 옵션은 칩으로 선택하고, 세부 스타일은 **Advanced**에서 설정해요. 휴대폰에서 Inspector와 레이어 목록은 다른 도구들과 마찬가지로 상단 막대 바로 아래로 펼쳐지는 패널 하나를 공유해요. 아래쪽 막대의 **Inspect**와 **Layer/Page**를 누르면 패널의 해당 탭이 열려요. 패널 아래 가장자리의 손잡이를 끌거나 탭해서 두 탭만 보이는 띠, 화면의 절반, 거의 전체 화면 사이로 크기를 바꿔요. 절반 크기일 때는 패널 아래 캔버스에서 선택 영역을 볼 수 있어요. Escape는 패널을 다시 띠로 접고 선택 영역은 유지해요.

![Inspector의 Document 섹션: Selection과 Canvas 탭 아래에 Dimensions와 Style & look이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

<!--i:eti-crop-->
## 크기 조정, 배율 조정, 회전

개체를 선택하고 핸들을 끌면 크기가 바뀌고, 선택 영역 아래의 둥근 핸들을 끌면 개체가 회전해요. 크기를 바꾸는 드래그에는 두 가지 모드가 있어요.

- 기본 모드인 **Resize**는 박스 크기만 바꿔요. 텍스트는 새 크기에 맞춰 다시 줄바꿈되고 글꼴 크기, 선 두께, 모서리 반경, 효과는 기존대로 유지돼요.
- **Scale**은 콘텐츠를 포함해 개체를 확대하거나 축소해요. 글꼴 크기, 선, 모서리 반경, 그림자, 흐림, 패딩, 간격이 같은 비율로 조정돼요.

`K`를 누르면 Scale이 켜지거나 꺼져요. 키보드 없이 쓰려면 Lolly 메뉴에서 **Scale mode**를 선택하거나 레일의 **Pointer** 버튼을 길게 누르거나 우클릭한 뒤 **Scale**을 선택하세요. 터치 화면에서는 개체 막대에도 Scale 토글이 제공돼요. Scale을 켜면 Pointer 버튼에 Scale 아이콘이 나타나고 모든 핸들 중앙에 점이 표시돼요. `V`나 **Escape**를 누르면 선택을 유지한 채 Resize로 돌아가요. 실수로 선의 배율을 바꾸지 않도록 모든 문서는 Scale이 꺼진 상태로 열려요. 문서를 열 때는 항상 Scale이 꺼져 있어요.

**수치로 배율 조정하기.** Scale을 켜거나 개체를 여러 개 선택한 뒤 개체 막대의 수치 표시를 클릭하면 **Scale** 팝오버가 열려요. 백분율이나 너비, 높이를 입력하고 3 x 3 격자에서 움직이지 않을 지점을 지정한 뒤 **Apply**를 선택하세요. 배율을 한 번 조정할 때마다 실행 취소 한 단계로 기록돼요.

**여러 개체 선택하기.** 여러 개체를 선택한 영역에는 가장자리와 모서리 모두 핸들이 있어요. 모든 개체가 똑바로 있거나 정확히 90도 단위로 회전해 있고, 선택에 그룹이나 원이 없으면 모서리를 끌어 너비와 높이를 자유롭게 바꿀 수 있어요. 그 외에는 선택 영역의 비율이 유지되고 수치 표시에 **Proportional**이 붙어요. 끌 때 작은 라벨에 크기가 표시되고, Scale 모드에서는 백분율이 표시돼요.

**선택 영역 뒤집기.** 우클릭한 뒤 **Flip horizontal**이나 **Flip vertical**을 고르거나 `Shift+H`나 `Shift+V`를 누르세요. SVG, PDF, PNG로 내보낸 파일에도 뒤집힌 상태가 유지돼요.

**드래그 중 누르는 키**는 누르거나 놓자마자 반영돼요. 단축키 시트(`?`)에서도 이 키들을 확인할 수 있어요.

| 누르는 키 | 크기 또는 배율 조정 | 회전 | 이동 |
|---|---|---|---|
| **Shift** | 비율 유지(Scale에서는 항상 유지돼요) | 15도씩 회전 | 변화 없음 |
| **Alt** (Option) | 중심을 기준으로 조정 | 자유 회전 | 스냅과 격자 끄기 |
| **Cmd/Ctrl** | 스냅과 격자 끄기 | 자유 회전 | 스냅과 격자 끄기 |

아무 키도 누르지 않으면 회전 각도가 15도 단위 각도에서 4도 이내에 들어왔을 때 가장 가까운 15도 단위로 스냅돼요. 아트보드는 회전할 수 없어서 회전 핸들도 없어요.

::: details 핸들, 잡기 영역, 터치 조작
**가장자리의 어느 곳이든 잡으세요.** 선택 영역의 각 변은 크기를 조정하는 띠예요. 마우스나 펜으로 쓸 때는 각 모서리 바로 바깥에 회전 영역도 있어요. 포인터 모양이 드래그할 때의 동작을 알려줘요. 띠나 영역을 눌러도 끌기 시작해야 크기 조정이나 회전이 되므로, 그냥 클릭하면 여전히 선택돼요. 잠긴 개체에는 핸들이나 띠, 영역이 없어요.

**작은 개체도 이동할 수 있어요.** 화면상 크기가 25픽셀 이하인 개체에서는 가운데 핸들이 숨겨지고 나머지 핸들은 윤곽선보다 약간 바깥으로 나가요. 그래서 개체를 눌러 이동할 수 있어요. 10픽셀 이하에서는 모서리 핸들도 숨겨지며, 가는 선은 양 끝에 핸들이 하나씩 남아요. 핸들과 겹치지 않는 가는 선이나 작은 개체의 바로 옆을 누르면 해당 개체가 이동해요.

**넓은 잡기 영역.** 터치 화면의 각 모서리 영역은 화면에 표시된 선택 영역 너비와 높이의 4분의 1이며, 최소 24픽셀에서 최대 44픽셀이에요. 각 변의 영역은 두 모서리 사이를 채워요. 선택 영역이 너무 작으면 잡기 영역이 윤곽선 바깥으로 나가요. 포인터나 손가락이 닿은 영역에는 음영이 표시돼요. 마우스나 펜에서도 이 영역을 사용하려면 Lolly 메뉴의 **Large grab areas**를 켜세요. 설정은 현재 기기에 저장돼요.

**선택 영역에 두 손가락 놓기.** 터치 화면에서 선택한 개체 위에 두 손가락을 놓으세요. 핀치하면 배율이 조정되고, 비틀면 회전하고, 두 손가락을 함께 움직이면 선택 영역이 이동해요. 각 제스처는 실행 취소 한 단계로 처리돼요. Scale이 켜져 있으면 핀치할 때 콘텐츠의 배율도 바뀌고, 꺼져 있으면 비율을 유지하며 크기가 바뀌어요. 비틀기는 15도 단위 각도에 가까워지면 스냅되지만 두 손가락으로 이동할 때는 스냅되지 않아요. 첫 손가락은 선택 영역에 닿아야 하고, 두 번째 손가락은 곧바로 선택 영역이나 그 가장자리 바로 바깥에 닿아야 해요. 다른 곳에 두 손가락을 놓으면 보기를 확대/축소하거나 이동해요. 선택 영역에 아트보드나 잠긴 개체가 포함돼 있거나, 보기의 대부분을 차지하거나, 보기 가장자리를 넘어서 있는 경우에도 두 손가락은 같은 방식으로 보기를 조작해요.
:::

<!--i:eti-pen-tool-->
## 나만의 도형 그리기

대부분의 레이아웃은 박스, 원, 둥근 프레임으로 만들 수 있어요. 다른 도형은 레일의 **Pen** 버튼이나 `P`를 눌러 그리기 모드를 시작하세요. 네 키로 모드를 바꿔요. `V`는 Pointer, `P`는 Pen, `Shift C`는 **Pencil**, `N`은 **Edit points**예요. Pointer로 바꾸면 언제나 그리기 모드에서 나와요.

- **클릭**해서 점을 놓으세요. 기본 곡선 유형에서는 **클릭한 채 끌면** 점의 핸들이 뻗어 나와 곡선을 만들고, **Alt**를 누른 채 클릭하면 각진 모서리가 생겨요. 다른 곡선 유형은 모든 점이 모서리여서 끌어도 아무 일도 일어나지 않아요.
- **Shift**를 누른 채 클릭하면 새 선분이 이전 점을 기준으로 15도의 배수 각도에 놓여 수평선, 수직선, 45도 선을 만들 수 있어요. 핸들을 끌어낼 때도 Shift를 누르면 같은 각도 단위로 움직여요.
- 점을 놓을 때는 아트보드, 다른 박스, 같은 경로의 다른 점에 스냅돼요. 그리는 동안 Alt는 격자를 끄고, 나중에 점을 끌 때는 격자와 가장자리를 모두 꺼요.
- **처음 놓은 점을 클릭**하면 도형을 닫아요. 열린 그림으로 남기려면 **Enter**를 누르거나 더블클릭하거나 도구를 전환하세요.
- **Escape**를 처음 누르면 그리기를 취소하고, 다시 누르면 펜에서 나와요.
- 그리는 도중 **Delete**나 Undo(`⌘ Z` 또는 `Ctrl Z`)를 누르면 마지막 점이 제거돼요.

**열린 경로를 이어서 그리기.** Pen이 켜져 있을 때 열린 경로의 어느 쪽 끝이든 누르면 이어 그릴 수 있어요. 클릭할 때마다 그 끝 다음에 점이 추가되고, 시작점에서 이어 그렸다면 첫 점 앞에 추가돼요. Enter는 결과를 유지하며 Escape는 경로를 원래대로 두어요. 경로는 같은 박스로 남으면서 채우기, 선, 화살촉을 유지하고, 실행 취소 한 번으로 변경을 되돌릴 수 있어요. Delete는 추가한 점만 지워요. 닫힌 도형, 박스에 연결된 선, 여러 부분으로 나뉜 경로에는 자유 끝이 없어요.

**Pencil로 자유 곡선 그리기.** `Shift C`를 누르거나 레일의 **Pen** 버튼을 길게 누르거나 우클릭한 뒤 **Pencil**을 고르세요. 다시 Pen을 선택할 때까지 버튼에는 Pencil이 표시돼요. Pencil은 드래그하는 동안 획을 기록해요. 손을 놓으면 Lolly가 획을 베지어 핸들이 있는 몇 개의 점으로 매끄럽게 정리해요. 급격히 꺾인 부분은 모서리로 유지되고, 곡선은 원래 획에서 화면상 두어 픽셀 이내에 머물러요. 시작점 근처에서 끝낸 획은 닫혀요.

Pen이나 Pencil로 그린 경로도 일반 박스예요. 다른 박스와 똑같이 경로를 이동하고, 크기를 바꾸고, 회전하고, 그룹으로 묶고, 정렬하고, 쌓임 순서를 바꾸고, 채우거나 음영을 넣거나 투명도를 낮출 수 있어요. 첫 경로에는 브랜드의 경로용 채우기와 선이 적용되고, 이후 경로에는 마지막으로 사용한 설정이 적용돼요. 브랜드에 경로용 설정이 없으면 새 경로는 그릴 때 쓴 색으로 선을 그려서 도형이 보이지 않는 일이 없어요.

**점 다시 수정하기.** 도형을 더블클릭하거나 개체 막대에서 **Edit points**를 사용하세요. 점을 끌어서 옮기고, 핸들을 끌어서 곡선 방향을 바꾸고, 곡선을 클릭해서 점을 넣을 수 있어요. 여러 점을 상자로 둘러싸도록 끈 뒤 Delete를 눌러도 돼요. 경로에는 언제나 두 개 이상의 점이 남아요.

- 점을 끌면서 **Shift**를 누르면 경로상 다음에 있는 움직이지 않는 점을 기준으로 각도가 15도씩 변해요. 핸들을 끌면서 Shift를 누르면 핸들 자체의 점을 중심으로 일정 각도씩 돌아요. Shift를 누른 채 클릭하면 여전히 점이나 핸들이 선택에 추가되고, 끌기 시작할 때부터 각도 단위가 적용돼요.
- 끄는 점은 아트보드, 다른 박스, 경로 안의 다른 점에 스냅돼요. Alt를 누르면 원하는 곳에 자유롭게 놓을 수 있어요.
- 핸들을 클릭한 다음 **Delete**를 누르면 핸들이 해당 점으로 들어가요. 점의 그쪽 면은 모서리로 바뀌어요. 점이 선택돼 있으면 Delete가 그 점을 지워요.

**Spline type**에서 점들을 통과하는 곡선 유형을 정해요.

| 유형 | 동작 |
|---|---|
| **Smooth (auto)** | 기본값이에요. 핸들 길이를 자동으로 정하므로 클릭만 해도 매끄러운 곡선이 만들어져요. 직접 설정한 핸들은 방향을 고정하고, 길이는 여전히 곡선이 정해요. |
| **Bezier handles** | 모든 핸들을 직접 조정하며, 점을 넣어도 곡선이 움직이지 않아요. |
| **Through the points** | 핸들 없이 모든 점을 통과해요. |
| **B-spline** | 점을 통과하지 않고 근처를 지나서 더 부드러운 선을 만들어요. |
| **Straight lines** | 폴리라인이에요. |

기존 경로를 핸들이 자동 설정되는 유형으로 바꾸면 직접 설정한 핸들 길이가 사라지므로 먼저 확인을 요청해요. 그리는 도중에 바꾸면 즉시 적용되고 끌어냈던 핸들이 제거돼요. **Bezier handles**로 바꿀 때는 아무것도 사라지지 않아요. 그리는 중에 전환하면 바로 적용되고 끌어낸 핸들이 없어져요.

각 점에는 연속성 규칙도 있으며 점의 모양으로 구분해요. 사각형은 **Corner**(핸들이 각각 움직여요), 원은 **Smooth**(핸들이 일직선을 유지해요), 고리가 있는 원은 **Symmetric**(일직선이고 길이가 같아요)이에요. 선택한 점의 규칙을 지정하면 곡선이 즉시 바뀌어요.

![링크에서 바로 렌더링한 두 펜 경로: 선으로 그린 S자 곡선과 내부를 채운 닫힌 덩어리 모양](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

그린 경로는 다른 박스처럼 공유 링크에 담겨 전달되고, 명령줄에서 렌더링해도 같은 결과가 나와요.

<!--i:eti-blend-->
## 도형 결합하기

도형을 두 개 이상 선택하고 캔버스를 우클릭한 뒤(터치 화면에서는 두 손가락으로 탭) 다음 중 하나를 선택하세요.

- **Union**은 맨 위 도형의 페인트를 적용한 하나의 도형으로 합쳐요.
- **Subtract**는 맨 아래 도형에서 그 위에 있는 모든 도형을 빼요.
- **Intersect**는 겹친 부분만 남겨요.
- **Exclude**는 겹친 부분을 제외한 나머지를 남겨요.

도형 하나에 적용하는 동작도 세 가지 있어요. **Outline stroke…**는 선을 같은 두께의 채워진 윤곽 도형으로 바꿔요. **Offset path…**는 윤곽선을 바깥으로 넓히고, 음수를 넣으면 안쪽으로 줄여요. **Simplify**는 윤곽선을 유지하면서 더 적은 선분으로 경로를 다시 만들어요.

![Subtract로 만든 초승달과 실제 구멍이 있는 고리](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

결과는 펜으로 편집할 수 있는 일반 베지어 곡선의 새 경로예요. 원래 스플라인 유형은 이어받지 않아요. 선 패널의 **Fill rule** 컨트롤은 윤곽이 겹치는 부분을 채울지(*non-zero*) 구멍으로 만들지(*even-odd*) 정해요. 이 동작은 도형을 파괴하는 대신 실행을 거절해요. 겹치지 않는 두 도형의 교차를 요청하면 아무것도 바뀌지 않아요. 이 동작들은 도형을 파괴하지 않아요. 서로 겹치지 않는 두 도형에 교차를 적용해도 변화가 없어요. 텍스트와 이미지 박스에는 윤곽선이 없으므로 건너뛰어요.

<!--i:eti-image-->
## 이미지 트레이싱하기

이미지 하나를 선택해 우클릭하고 **Trace image…**를 고르면 이미지를 편집 가능한 도형으로 바꿀 수 있어요. 프리셋을 선택한 뒤 **Trace**를 누르세요.

- **Logo**는 몇 가지 단색을 찾아 선명한 가장자리와 정확한 원 및 선을 유지해요. 그라데이션이나 사진의 색조가 있는 이미지는 Logo가 거절하고 이유를 알려줘요.
- **Illustration**은 평면 아트나 포스터화한 이미지의 여러 색상을 채워진 도형으로 트레이싱해요.
- **Line art**는 밝은 페이지 위의 어두운 선을 검은 도형으로 트레이싱해요.
- **Centreline**은 어두운 선을 두께를 바꿀 수 있는 단일 선으로 트레이싱해요.

도형들은 이미지 위에 그룹으로 추가되고 이미지는 제자리에 남아요. 경로만 보려면 이미지를 숨기거나 삭제하세요. 트레이싱은 기기에서 Cancel 버튼이 있는 백그라운드 작업으로 실행되며 업로드되는 것은 없어요. 1500픽셀 이미지는 보통 1초에서 몇 초가 걸리고, 복잡한 사진은 더 오래 걸려요.

트레이싱은 박스에 보이는 내용을 따르므로 잘린 이미지(Cover)는 보이는 부분만 트레이싱해요. 다음 제한이 적용돼요.

- 트레이싱 전에 이미지의 긴 변을 최대 1500픽셀로 줄이므로, 가장자리 위치의 정밀도는 원본이 아닌 축소된 크기를 기준으로 해요.
- 한 번 트레이싱할 때 도형은 최대 1,500개, 점은 최대 60,000개까지 만들어요. 사진은 보통 이 한도를 넘어요. 그러면 Lolly Design이 한도 초과를 알리고 아무것도 바꾸지 않아요. Logo나 Line art를 쓰거나 더 단순한 이미지를 사용해 보세요.
- 그라데이션은 단색 띠로, 부드러운 그림자는 가장자리가 뚜렷한 도형으로 바뀌어요.
- 이미지 박스의 모서리 반경, 도형 마스크, 효과는 경로에 적용되지 않아요.
- 같은 이미지와 프리셋은 언제나 같은 도형을 만들어요.

<!--i:eti-hexagon-->
## 선

박스, 이미지, 보드, 펜 경로에는 각각 선을 넣을 수 있어요. 선에는 색상, 두께, 스타일(실선, 파선, 점선)이 있어요. 선 설정 행은 Inspector의 **Fill** 아래에 있고, 개체 막대의 **Stroke** 버튼으로 열어요.

**Position**은 윤곽선에서 선이 놓이는 위치를 **Inside**, **Centre**, **Outside**로 정해요. 박스는 기본적으로 안쪽에 선을 그려서 처음 그린 바깥 가장자리를 유지해요. 펜 경로는 곡선을 중심으로 선을 그려요. 선이 가운데나 바깥에 있으면 채우기, 이미지, 텍스트는 선의 안쪽 가장자리 안에 머물고, 선택 윤곽선은 박스 가장자리에 유지돼요. 열린 경로에는 안쪽이 없으므로 선을 항상 가운데에 그려요. 보드에서는 페이지 가장자리가 내보내기 경계이므로 선이 언제나 페이지 안쪽에 있어요.

**변마다 선 두께 설정하기.** 사각형, 둥근 박스, 알약 모양, 보드에서는 두께 옆 토글을 누르면 **Top**, **Right**, **Bottom**, **Left**의 두께 네 개가 나타나요. 한 변을 0으로 설정해 숨기면 다른 도형 없이 구분선이나 밑줄을 만들 수 있어요. 토글은 네 칸을 표시하거나 숨기기만 하며 값은 바꾸지 않아요. 변들의 두께가 서로 다르면 두께에 **Mixed**가 표시돼요. 여기에 두께를 입력하면 네 변이 모두 설정돼요. 모든 변은 색상, 위치, 스타일을 공유해요. 둥근 모서리는 CSS 테두리처럼 인접한 변의 두께에 맞춰 곡선을 이뤄요. 타원, 원, 펜 경로는 둘레 전체를 하나의 두께로 그려요.

::: details 형식별로 선을 담는 방식
| 형식 | 위치 | 변별 두께 |
|---|---|---|
| SVG, PDF, PNG와 기타 이미지 | 정확해요. 펜 경로의 안쪽 또는 바깥쪽 선은 두 배 두께로 그린 뒤 윤곽선의 한쪽으로 잘라요. | 실선은 바깥쪽과 안쪽 가장자리 사이의 도형 하나로 정확하게 표현돼요. 파선이나 점선은 SVG에서 각 변을 따라 끊어진 선으로, PDF에서는 실선으로 그려져요. |
| Penpot | 안쪽, 가운데, 바깥쪽 위치가 Penpot의 선 정렬로 전달돼요. 보드는 항상 `inner`예요. | Penpot 2.19 이상은 네 두께를 기본 기능으로 읽어요. Penpot 2.18은 위쪽 두께를 둘레 전체에 적용하고, Penpot 2.17 이하는 변별 두께가 담긴 파일을 거절해요. |
| PowerPoint | PowerPoint는 도형 가장자리를 중심으로 선을 그려요. 가운데 위치는 정확해요. 바깥쪽 위치는 도형을 두께의 절반만큼 밖으로 옮겨 PowerPoint의 선이 박스 바깥에 오게 해요. 안쪽 위치는 이전 내보내기에서 기록한 가운데 선을 유지해요. | 선이 없는 도형 위에 별도 도형(바깥쪽과 안쪽 가장자리 사이의 고리)으로 선을 배치해요. |
| dotLottie | Lottie의 선은 가운데에 있으므로 박스의 바깥쪽 선이나 펜 경로의 안쪽 또는 바깥쪽 선은 메시지와 함께 거절돼요. | 메시지와 함께 거절돼요. |
:::

가운데에 놓인 반투명 선은 캔버스와 모든 내보내기에서 안쪽 절반을 통해 채우기가 아니라 페이지가 비쳐 보여요. 가져온 Penpot 파일은 각 선의 정렬과 변별 두께를 유지해요. Figma 파일의 `strokeAlign`과 개별 선 두께도 그대로 가져와요.

<!--i:eti-box-->
## 디자인 안의 3D 장면과 도구

박스에는 이미지 외의 것도 넣을 수 있어요. 3D 장면이나 도구는 렌더링한 이미지가 아닌 생성 설정을 보관하므로 문서가 요구하는 어떤 크기와 시점에도 박스를 다시 그려요. 원본을 업데이트하면 그 원본을 사용하는 모든 디자인에 반영돼요.

### 3D 장면

레일의 추가 메뉴에서 **3D scene**을 선택하고 드래그해서 프레임을 만드세요. 새 박스에 Lolly 3D Studio가 열리고, 거기서 지정한 설정이 캔버스로 돌아와요. Inspector의 **3D scene** 섹션에서 **Edit in 3D Studio**를 누르면 스튜디오가 다시 열려요. 포스터, 타임라인, 내보내기, 공유는 [Lolly Design에 장면 배치하기](/info/3d-studio.html#place-a-scene-in-lolly-design)에서 다뤄요.

### 디자인 안의 도구

레일의 추가 메뉴에서 **Image**를 선택하고 프레임을 끌어 만든 뒤 선택기의 **Tools** 탭에서 도구를 고르세요. 도구의 기본 설정으로 프레임이 채워지고, Inspector에 도구 컨트롤이 담긴 **Tool** 섹션이 열려요. 필드를 바꾸면 잠시 후 박스가 업데이트되며 실행 취소 한 단계로 기록돼요. **Image fit**과 **Image position**은 일반 이미지와 동일하게 작동하고, **Replace with another tool or image**는 박스의 내용을 교체해요.

**움직이는 도구**는 박스 안에서 재생돼요. 반복되는 일러스트는 캔버스에서도 반복되고, 타임라인을 열면 재생 헤드를 따라가며, GIF, MP4, WebM으로 프레임마다 내보내져요. 도구가 반복 길이를 명시하면 박스에 해당 길이의 클립이 생겨 동영상에 온전한 반복이 담겨요. 타이밍을 직접 조정한 클립은 그 타이밍을 유지해요. 도구의 모션을 끄면 박스는 정지 이미지로 바뀌어요.

<!--i:eti-film-->
## 타임라인 (Sequence)

**Sequence**는 아트보드 아래에 고정된 Lolly Design의 타임라인이에요. 모든 박스는 특정 시점에 시작해서 정해진 시간 동안 이어지고, 나타나고 사라질 때 애니메이션을 적용할 수 있어요.

Lolly Design의 **Video** 템플릿은 짧은 시퀀스로 시작해요. 시퀀스 행에는 타이밍이 지정된 텍스트 카드 두 개가 있고, 그 아래에는 절차적으로 생성된 배경 음악이 있어요.

![Sequence 타임라인: 재생 컨트롤, 눈금자, 오버레이 레인, 클립과 이음새 칩이 있는 자석식 시퀀스 행, Always on 띠](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

행에는 두 종류가 있어요.

- **시퀀스 행**은 자석처럼 붙어요. 클립들이 끝과 끝을 맞대고 배치되고, 하나를 끌면 재생 순서가 바뀌며, 하나를 지우면 빈틈이 닫혀요. 이 행이 중심축이에요.
- **오버레이 레인**은 자유롭게 배치돼요. 하단 자막, 로고, 캡션이 각각 자기 레인에서 지정된 시간에 중심축 위로 겹쳐 보여요.
- 그 아래의 **Always on**에는 타이밍이 없는 박스들이 있고, 처음부터 끝까지 표시돼요. 칩의 `+`를 누르면 박스가 레인으로 옮겨지고, **Make always on**을 누르면 돌아와요.

타임라인이 열려 있으면 Space와 화살표 키로 재생 헤드를 움직여요. 이미 타이밍이 설정된 컴포지션은 타임라인이 자동으로 열려요.

**편집.** 클립 가운데를 끌어 이동하고, 양 끝 가까이를 끌어 다듬고, **Split at playhead**(또는 `S`)를 눌러 둘로 나눠요. 나누려면 클립에 **Length**가 설정돼 있고 재생 헤드가 클립 안쪽에 조금 들어와 있어야 하므로, 배경 음악처럼 끝이 정해지지 않은 클립은 나눌 수 없어요. **Snap to edges**는 기본으로 켜져 있으며 클립 가장자리, 재생 헤드, 정수 초에 스냅돼요. 스냅 없이 끌려면 Alt를 누르세요. 끌기는 각각 실행 취소 한 단계이며, 끄는 동안의 미리보기는 결과와 같아요.

클립을 선택하면 Inspector에서 같은 편집을 숫자로 할 수 있어요. **Length**, **Trim in**(원본에서 클립이 시작되는 지점까지의 길이), ×0.25부터 ×4까지의 **Speed**, **Animate in**과 **Animate out** 및 각각의 길이, **Mute clip**이 있어요. 마그네틱 행의 클립에는 **Start** 입력란이 없어요. 행이 순서를 정하기 때문이에요.

**전환**은 프리셋이에요. Fade, Pop, Grow, Rise, Drop, 네 가지 Slide, Zoom in과 out, Tilt, Swoop, Spin, Drift 또는 **Cut (no animation)**이 있어요. 거리는 개체 크기에 비례하므로 하나의 프리셋이 전체 프레임을 채우는 카드와 작은 배지에 모두 맞아요. 시퀀스 행의 두 클립 사이에 있는 **이음새 칩**에서 **Cut** 또는 **Crossfade**를 골라요. 칩을 다시 열어 **Length (ms)**를 설정한 뒤 **Done**을 누르세요. 크로스페이드에서는 첫 클립이 컷 지점을 지나서도 재생되며 서서히 사라지고, 다음 클립이 서서히 나타나요. 미리보기와 파일에서 모두 같아요.

**소리.** **Audio** 클립은 타임라인에 파형, 다듬기, 음소거와 함께 있어요. Video 템플릿이 생성하는 배경 음악은 내보낼 때 합성되므로, 렌더링할 때까지 막대에 파형이 없고 소리도 나지 않아요. 마이크를 눌러 타임라인에 **보이스오버를 녹음**하세요. 시작 카운트와 레벨 미터가 있어요. 녹음한 것은 재생 헤드 위치에 사용자 에셋으로 저장돼요. 마이크 옆 카메라 버튼은 같은 방식으로 **동영상을 녹화**하며 아트보드에 맞게 잘라내므로, 동료가 공유 링크에서 클립을 추가할 수 있어요. 소리가 있는 클립을 선택하면 타임라인 아래에 볼륨, 팬, EQ, 피치, 정규화, **Voice cleanup** 같은 효과를 위한 스트립이 열려요. 시퀀스 편집기 가이드의 [소리](/info/sequence-editor.html#sound)에서 스트립을 다뤄요. 내보내기 패널의 **Audio track**은 별개예요. 페이드와 더킹이 있는 배경음 하나를 전체 클립 아래에 깔아요.

![음악 클립을 선택한 타임라인: 아래쪽 스트립에 Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume과 Effect 슬롯이 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Czzfxm%25253A7%25253Alofi%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**렌더링.** 모션 내보내기는 각 프레임을 정확한 시점에 그리고 디코딩하고 인코딩하므로, 파일은 기기의 속도에 영향을 받지 않아요. MP4와 WebM에는 실질적인 프레임 제한이 없어요. 길이를 직접 입력하지 않으면 타임라인 길이가 재생 시간을 정해요. 다른 내보내기와 마찬가지로 Content Credentials가 찍혀요. 스틸 내보내기는 재생 헤드의 프레임을, 또는 **Frames** 입력란으로 컨택트 시트를 만들어요. [타임드 컴포지션의 스틸컷](/info/exporting.html#stills-from-a-timed-composition)을 참고하세요. 시퀀스는 한 시간으로 제한돼요. GIF와 애니메이션 PNG는 모든 프레임을 메모리에 보관하므로 짧은 클립에 맞아요. 여기서는 프레임별 렌더링을 사용하므로 **Record live**가 숨겨져요.

**키프레임, 깊이, 카메라.** 전환은 클립이 등장하고 사라질 때 클립에 애니메이션을 줘요. 클립 안에서 박스의 상태를 정하려면(이동, 페이드, 흐림, 페이지 위로 들어 올렸다 다시 내려놓기) 클립을 선택하고 **+Keyframe**을 누르세요. 타임라인 도구의 마름모, 캔버스 개체 막대의 마름모, 또는 타임라인에 포커스가 있을 때 **Shift+K**로 할 수 있어요. 재생 헤드 위치가 다음 편집을 기록할 상태를 정해요. 같은 키프레임으로 시간 구성에 카메라를 넣어 다가가고, 좌우로 움직이고, 초점을 옮길 수 있어요. 이징은 [스프링](/info/animating.html#springs)이나 디자인 시스템이 정한 곡선일 수 있고, 위치 키프레임의 핸들을 끌면 캔버스의 [모션 경로](/info/animating.html#edit-the-motion-path)가 휘어요. [애니메이션 만들기](/info/animating.html)가 전체 가이드이며, [시퀀스 편집기](/info/sequence-editor.html)는 선택, 어니언 스킨, 나누기, 다듬기, 마커를 다뤄요.

<!--i:eti-checklist-->
## 내보내기 전에

파일을 보내기 전에 **Before you export** 카드가 문서를 확인해요. 카드는 Inspector의 **Document** 섹션과 내보내기 패널에 나타나요.

카드는 저장된 레이어 구조를 읽은 뒤, 렌더링이 끝난 캔버스에서 잘린 텍스트와 단색 대비를 확인해요. SVG와 PDF의 윤곽선 처리에 쓰이는 글꼴 레지스트리에 각 텍스트 구간에 임베드할 수 있는 글꼴 바이트가 있는지 확인해요. 내보낼 때 [대체 글꼴](/info/fallback-fonts.html)로 그리는 텍스트도 지원되는 것으로 봐요. 대체 글꼴이 없는 문자 체계나 해당 글꼴의 문자 집합에 없는 중국어, 일본어, 한국어 문자는 여전히 보고돼요. 이미지와 그라데이션 배경은 시각적으로 확인할 항목으로 나열되며, 대비 점수를 지어내지 않아요.

### 구성을 디자인 시스템과 비교해 확인하기

내보내기 패널의 카드는 구성과 디자인 시스템도 비교하며, 렌더링에 쓰이는 것과 같은 디자인 시스템 버전을 사용해요. 지정된 색상, 토큰 별칭, 글꼴 선택, 이미지 에셋 id를 확인해요. 사용자 지정 값은 의도한 것일 수 있고, 선언된 브랜드 에셋에 없는 이미지는 검토 항목이지 금지된 이미지가 아니에요.

색상이나 글꼴 제안이 있으면 해당 버튼이 그 레이어 하나를 바꾸고, **Undo**로 원래대로 되돌려요. 오래된 제안은 잠겼거나 그 이후 바뀐 레이어를 덮어쓰지 않아요. 비교에서 그라데이션, 효과, 중첩된 도구 콘텐츠, 권리, 주관적 품질은 제외해요. 어떤 검사도 Download를 막지 않아요.

### 조직의 작업 규칙과 글쓰기 신호

내보내기 패널의 카드는 텍스트 굵기와 정렬, 승인된 색상 조합, 면마다 로고 배치 같은 디자인 시스템의 작업 규칙도 레이어별로 확인해요. 각 확인 결과는 규칙 위에 레이어 이름을 보여줘요. 필수 규칙 위반은 경고이고, 권장 규칙 위반은 참고 사항이에요. 로고에 관한 결과는 카탈로그에 있는 각 로고의 이름을 알려줘요. 이 빌드에 검사기가 없는 규칙은 준수했다고 하지 않고 확인하지 않았다고 나열해요. [규칙](/info/brand-studio.html#rules)에서 규칙을 나열하며, `lolly check`는 저장된 문서에 같은 규칙을 적용해요. Lolly Work 파트너 프로그램에서는 카드가 파트너 회사의 마크를 [파트너 키트](/info/manage/partner-programmes.html#partner-kits)와 비교해 확인하고, 측정할 수 없었던 것도 알려줘요.

같은 카드는 문서에 그려지는 텍스트의 글쓰기 신호도 보여줘요. 먼저 등급(없음, 약함, 주목할 만함, 강함)을 보여주고, 다음으로 100점 만점 점수와 표시된 구절 최대 세 개를 담은 Lolly Verify의 문장을 보여주며, 각 구절이 있는 레이어도 함께 알려줘요. **Open the text in Verify**는 전체 분석을 위해 해당 텍스트를 [Lolly Verify](/#/verify)로 가져가요. [Lolly Verify의 AI 증거](/info/verify-ai-evidence.html)에서 점수가 무엇을 평가하는지 설명해요. 점수는 신호이지 판정이 아니에요. 점수는 생성된 글에 흔한 패턴을 세며, 누가 썼는지는 알 수 없어요. 숨겨진 레이어는 두 검사 모두에서 제외하고, 카드가 그 개수를 알려줘요.

필수 작업 규칙 위반과 강한 글쓰기 신호는 카드의 "수정할 항목" 합계에 포함돼요. 권장 규칙 관련 결과는 알아둘 사항으로 집계돼요. 확인 결과는 작업을 막지 않아요. Download는 계속 사용할 수 있고, 무시 처리하거나 예외로 기록할 것도 없어요. 열린 문서에서 작업하는 에이전트도 사이트 도구로 같은 보고서를 받아요([열린 문서의 에이전트](/info/open-document-agents.html)).

::: note 인쇄 검사에는 기능 플래그가 필요해요
인쇄 검사(도련, 해상도, 잉크 사용량, 인쇄판 수)는 **Settings → Feature flags → Print preflight**를 켜면 같은 카드에 추가돼요. 다른 도구에서는 이 플래그가 켜져 있을 때만 카드가 나타나요. [파일 내보내기](/info/exporting.html)에서 인쇄 검사를 설명해요.
:::

<!--i:eti-monitor-->
## 발표하기

아트보드로 이루어진 Lolly Design 문서는 덱이에요. 상단 막대에서 **Present**를 누르면 캔버스에 놓인 순서대로 각 아트보드가 전체 화면 슬라이드가 돼요.

문서의 **Design outcome**이 **Slides**가 되기 전까지 버튼에는 **Preview**가 표시돼요. 덱은 렌더링된 아트보드의 사본으로 실행되므로, 나가면 원래 있던 곳으로 돌아와요.

발표 버튼 **Present** 옆 화살표를 누르면 **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)**, **Export slides as video**가 열려요.

| 키 | 하는 일 |
|---|---|
| **Space**, `→`, **Page Down** | 다음 단계 또는 슬라이드(또는 오른쪽 가장자리의 띠를 클릭) |
| `←`, **Page Up** | 뒤로(또는 왼쪽 가장자리의 띠를 클릭) |
| **Home**, **End** | 첫 슬라이드 또는 마지막 슬라이드 |
| `O` | 개요: 모든 아트보드를 캔버스에 배치한 대로 표시해요. 하나를 클릭하면 열려요 |
| `S` | 발표자 보기: 두 번째 창에 현재 슬라이드, 다음 슬라이드, 노트, 시계 표시 |
| `B` | 검은 화면. 아무 키나 누르면 슬라이드로 돌아와요 |
| `F` | 전체 화면으로 돌아가기 |
| `K` | 키오스크 덱 일시 정지 또는 다시 시작 |
| **Escape** | 한 단계 뒤로: 개요에서 덱으로, 덱에서 편집기로 |

포인터를 움직이면 작은 컨트롤 막대가 나타나고 멈추면 숨겨져요. 브라우저가 발표자 팝업을 막으면 발표자 보기가 덱 위의 패널로 열려요. 노트는 각 아트보드에 속하며 슬라이드에는 나타나지 않아요.

터치 화면에서는 왼쪽으로 쓸어 다음 단계나 슬라이드로 가고, 오른쪽으로 쓸어 뒤로 가요. **Slide** 또는 **Fade** 전환은 손가락을 따라가다가 놓으면 마무리돼요. **Cut**, **Morph**, **Fly between artboards** 전환은 손을 놓으면 전체가 재생돼요. 짧고 느리게 쓸면 아무것도 바뀌지 않아요. 웹 페이지 박스, 동영상 컨트롤, 스크롤되는 박스, 선택한 텍스트는 자체 제스처를 유지하므로, 여기서는 슬라이드를 넘기는 쓸기가 시작되지 않아요. 세로 스크롤과 핀치 확대/축소는 평소처럼 동작해요. 동작 줄이기를 켜면 슬라이드는 바뀌지만 손가락을 따라가지는 않아요.

- **공개 단계.** 박스를 우클릭하고 **Always visible** 대신 **Reveal at step 1**, **2**, **3**을 고르세요. 해당 단계로 넘어가면 박스가 나타나요. 같은 번호의 박스는 함께 나타나요.
- **키오스크.** 아트보드에 **Length**를 설정하면 덱이 가느다란 진행 막대와 함께 그 시간만큼 머문 뒤 넘어가요. 디지털 사이니지로 쓰려면 링크에 `kiosk`를 추가해 덱이 끝나면 반복하게 하세요.
- **하위 슬라이드 스택.** 아트보드를 우클릭하고 **Stack under the previous slide**를 고르면 해당 슬라이드의 한 단계가 돼요. 개요에는 카드 하나가 표시되고, Inspector의 **Stack** 행에서 아트보드가 어느 슬라이드에 속하는지 알려줘요.
- **모프.** 연속된 두 슬라이드에 같은 **Morph match** 이름(예: `hero`)의 박스가 있으면, 전환이 컷으로 바뀌는 대신 그 박스를 이동하고 크기와 색상을 바꿔요. 덱 전체의 **Morph** 전환도 일치하는 모든 쌍에 같은 일을 해요.
- **내레이션.** 각 아트보드의 **Speaker notes**를 소리 내어 읽을 수 있어요. Inspector의 **Document** 섹션에서 **Voice**, 필요하면 **Blend with**로 섞을 두 번째 목소리, **Speed**, 밀리초 단위의 **Lead-in**과 **Tail**을 고르세요. **Show captions when presenting**은 말하는 내용을 자막으로 보여줘요. 음성은 기기에서 실행돼요. 같은 노트가 동영상 내보내기의 사운드트랙, PowerPoint 내보내기의 슬라이드 오디오, [SCORM 패키지](/info/create/exporting.html#scorm-course-packages)의 내레이션 영상이 돼요.

덱은 링크이기도 해요. `?present`는 덱을 열고 `s=`는 슬라이드를 골라요. 위치, 아트보드 id, 또는 빌드 단계의 `id.step`을 써요. 주소가 현재 슬라이드를 따라가므로, 보낸 링크가 그 슬라이드에서 열려요. [예약된 URL 매개변수](/info/url-parameters.html#what-happens-on-open)에서 둘 다 설명해요.

**Present with camera**는 비공개 컨트롤과 저장된 장면을 제공하며 슬라이드 위에 카메라, 로고, 이름 자막을 놓아요. [카메라와 함께 발표하기](/info/presenting.html)를 참고하세요. **Web page** 박스는 Inspector에서 **Make interactive**를 켜면 발표 중에 클릭커로 조작할 수 있어요. **Focus on click** 단계에서는 Up과 Down이 페이지를 제어하고 Next는 덱을 계속 넘겨요. [클릭커로 조작하는 라이브 페이지](/info/interactive-pages.html)에서 포커스 스타일, 스크롤 정지 지점, 사이트 승인을 다뤄요.

<!--i:eti-map-pin-->
## 다음에 살펴볼 내용

- **[Lolly Design의 텍스트](/info/text-composition.html)**: 캔버스에서 텍스트 편집하기, 프레임에 걸쳐 글 흐르게 하기, 타이포그래피.
- **[애니메이션 만들기](/info/animating.html)**: 키프레임, 깊이, 장면 카메라, Lift 레이어.
- **[Lolly Chart](/info/chart.html)**: 표를 벡터, 통계, 3-D, 시네마틱 차트로 그려 다른 도구처럼 박스에 담아요.
- **[디자인 가져오기](/info/design-import.html)**: Figma, Penpot, Illustrator, InDesign, Affinity, DXF 파일을 편집 가능한 박스로 열고, 편집 타임라인을 시퀀스로 열어요.
- **[규칙이 있는 디자인 공유하기](/info/create-a-tool.html)**: Lolly Design 문서를 선택한 입력만 있는 도구로 바꿔요.
- **[파일 내보내기](/info/exporting.html)**: 형식, 크기, 인쇄 단위, 동영상.
