# Design: 자유 캔버스

Design은 어떤 템플릿으로도 다룰 수 없는 레이아웃을 위한 도구예요. 처음부터 만드는 포스터, 슬라이드 덱, 사운드트랙이 있는 모션 작품 등이에요. 컨트롤 양식 대신 끌고, 크기를 조정하고, 회전하고, 글을 입력하는 박스의 캔버스가 주어져요. 다른 모든 도구와 같은 렌더 경로로 내보내므로 캔버스에서 보는 것이 받는 파일이에요.

이 페이지는 첫 박스부터 완성된 덱까지 캔버스를 안내해요. 창, 박스 다듬기, 직접 도형 그리기, 3D 장면과 다른 도구 배치하기, 시간 추가하기, 결과 확인하기, 완성된 덱 발표하기예요. 저장과 공유처럼 Design이 모든 도구와 공유하는 내용은 [Lolly 사용하기](/info/using.html)가 다뤄요.

![Design의 자유 캔버스 - 아트보드와 그 주변의 페이스트보드](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design 창

**상단 막대**는 **Home**, **File menu**, 문서 이름으로 시작해요(이름을 클릭하면 문서 이름을 바꿔요). 가운데에는 **Undo**, **Redo**, **History**, 확대/축소 컨트롤(**Fit all**과 **Fit artboard** 포함), **Timeline**, **Navigator**, **Inspector** 토글이 있어요. 오른쪽에는 **Share**, **Present**, **Export**가 있어요. 휴대폰에서는 덜 쓰는 버튼이 **More actions**로 옮겨져요.

옆쪽을 따라 내려가는 **도구 레일**에는 Lolly 메뉴와 그리는 도구가 있어요. **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, 그리고 Timeline, Artboards, Auto-arrange 버튼이에요.

![자유 캔버스의 도구 막대 - 끌기 손잡이, Lolly 메뉴, 그리고 Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards, Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

캔버스는 아트보드 주변의 디자이너용 작업대처럼 동작해요.

- **박스를 아트보드 밖에 둘 수 있어요.** 박스를 프레임 가장자리 너머로 끌어도 계속 보이고 선택할 수 있어요. 프레임 밖은 모두 흐려지고, 프레임은 그림자를 유지해 파일이 시작되는 곳을 표시해요.
- **아트보드만 내보내져요.** 프레임 밖의 모든 것, 또는 가장자리에 걸친 박스의 일부는 래스터와 벡터 형식 모두에서 출력물에서 잘려요.
- **Fit보다 더 축소**해서 보관해 둔 모든 것을 볼 수 있어요.
- 내보내기 크기를 바꿔서 **아트보드 크기를 조정**하세요. 박스는 위치를 유지하므로 기존 콘텐츠를 두고 레이아웃의 프레임을 다시 잡을 수 있어요.

![편집 스테이지: 정면 중앙의 아트보드, 왼쪽의 도구 레일, 모서리의 확대/축소 HUD](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator와 Inspector

**Navigator**는 모든 아트보드(**Artboards**, 덱에서는 **Slides**라는 제목)를 **Layers**의 접히는 그룹으로 나열해요. 아트보드 이름을 선택하면 그곳으로 이동하고, 펼치면 레이어를 선택하거나 순서를 바꿀 수 있으며, 화살표 키로 목록을 이동해요. Left는 아트보드 제목으로 돌아가요. **Pages**는 아트보드를 이름 붙은 페이지로 묶으며, 페이지를 고르면 편집기가 보여주는 아트보드만 바뀌어요.

**Inspector**는 선택한 개체의 텍스트나 이미지 컨트롤을 먼저 보여줘요. 옵션 칩이 빠른 선택을 맡고, **Advanced**에는 스타일 세부 설정이 있어요. 휴대폰에서는 Inspector가 **More actions**에서 시트로 열리며, Escape나 Back으로 시트를 닫아도 선택은 유지돼요.

![Inspector의 Document 섹션: Selection과 Canvas 탭, 그다음 Dimensions와 Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## 크기 조정, 배율, 회전

개체를 선택한 뒤 핸들을 끌어 크기를 바꾸거나, 선택 영역 아래의 둥근 핸들을 끌어 개체를 돌려요. 크기 드래그는 두 가지 모드 중 하나로 동작해요.

- 기본값인 **Resize**는 박스만 바꿔요. 텍스트는 새 크기에 맞게 줄바꿈되고 글꼴 크기, 선 두께, 모서리 반경, 효과는 그대로예요.
- **Scale**은 콘텐츠와 함께 개체 전체를 키우거나 줄여요. 글꼴 크기, 선, 모서리 반경, 그림자, 흐림, 패딩, 간격이 모두 같은 비율로 바뀌어요.

`K`를 눌러 Scale을 켜고 꺼요. 키보드가 없으면 Lolly 메뉴의 **Scale mode**를 선택하거나, 레일의 **Pointer** 버튼을 길게 누르거나(또는 버튼을 우클릭하고) **Scale**을 선택하세요. 터치 화면에서는 개체 막대에도 Scale 토글이 있어요. Scale이 켜져 있으면 Pointer 버튼이 Scale 아이콘을 보여주고 각 핸들 가운데에 점이 있어요. `V` 또는 **Escape**는 Resize로 돌아가며 선택을 유지해요. 모든 문서는 Scale이 꺼진 채로 열리므로 실수로 선을 확대하는 일이 없어요.

**숫자로 배율 조정하기.** Scale이 켜져 있거나 여러 개체를 선택한 상태에서 개체 막대의 수치 표시를 클릭하면 **Scale** 팝오버가 열려요. 백분율, 너비, 높이를 입력하고, 3 x 3 격자에서 고정할 지점을 고른 뒤 **Apply**를 선택하세요. 배율 조정은 각각 실행 취소 한 단계예요.

**여러 개체.** 여러 개체를 선택하면 모서리뿐 아니라 가장자리에도 핸들이 있어요. 모든 개체가 똑바로 서 있거나 정확히 90도 단위로 회전했고 선택에 그룹이나 원이 없으면, 모서리를 끌 때 너비와 높이가 자유롭게 바뀌어요. 그렇지 않으면 선택이 비율을 유지하고 수치 표시에 **Proportional**이 추가돼요. 끄는 동안 작은 라벨이 크기를 보여주며, Scale 모드에서는 백분율을 보여줘요.

**선택 뒤집기.** 우클릭해서 **Flip horizontal** 또는 **Flip vertical**을 선택하거나 `Shift+H` 또는 `Shift+V`를 누르세요(단독 `V`는 Pointer이므로 Shift를 써요). 거울 반전은 실제 변환이므로 내보낸 SVG, PDF, PNG에도 뒤집힘이 유지돼요.

**끄는 동안 누르는 키**는 누르거나 놓는 순간 적용돼요. 단축키 시트(`?`)에도 나열돼 있어요.

| 누르는 키 | 크기 조정 또는 배율 | 회전 | 이동 |
|---|---|---|---|
| **Shift** | 비율 유지(Scale은 항상 유지) | 15도 단위로 회전 | 변화 없음 |
| **Alt** (Option) | 중심에서 작업 | 자유롭게 회전 | 스냅과 격자 끔 |
| **Cmd/Ctrl** | 스냅과 격자 끔 | 자유롭게 회전 | 스냅과 격자 끔 |

키를 누르지 않으면 회전은 15도 단위 가까이 4도 이내로 오면 가장 가까운 15도로 당겨져요. 아트보드는 회전하지 않으므로 회전 핸들이 없어요.

::: details 핸들, 잡기 영역, 터치
**가장자리 어디든 잡을 수 있어요.** 선택의 각 변은 전체 길이를 따라 크기 조정 띠이며, 마우스나 펜으로는 각 모서리 바로 바깥에 회전 영역이 있어요. 포인터가 끌면 무슨 일이 일어나는지 보여줘요. 띠나 영역을 누르는 것은 끌기 시작한 후에만 크기 조정이나 회전이 되므로 일반 클릭은 예전처럼 선택해요. 잠긴 개체에는 핸들, 띠, 영역이 없어요.

**작은 개체도 계속 이동할 수 있어요.** 화면에서 25픽셀 이하인 개체는 가운데 핸들이 숨고 나머지는 윤곽선에서 조금 바깥으로 이동하므로, 개체를 누르면 개체가 이동해요. 10픽셀 이하에서는 모서리 핸들도 사라지고, 가는 선은 양 끝에 핸들을 하나씩 유지해요. 핸들에서 떨어진 가는 선이나 아주 작은 개체의 바로 옆을 누르면 개체가 이동해요.

**넓은 잡기 영역.** 터치 화면에서는 각 모서리 영역이 화면에 보이는 선택의 너비와 높이의 4분의 1이며 24~44픽셀 사이이고, 각 변 영역은 두 모서리 사이 구간을 덮어요. 선택이 이보다 작으면 영역이 윤곽선 바깥으로 이동해요. 포인터나 손가락 아래의 영역은 음영으로 표시돼요. 마우스나 펜으로도 같은 영역을 얻으려면 Lolly 메뉴에서 **Large grab areas**를 켜세요. 이 설정은 이 기기에 유지돼요.

**선택에 손가락 두 개.** 터치 화면에서 선택한 개체에 손가락 두 개를 올려요. 핀치로 배율을 조정하고, 비틀어서 회전하고, 두 손가락을 함께 움직여 선택을 옮기며, 모두 실행 취소 한 단계예요. Scale이 켜져 있으면 핀치가 콘텐츠도 확대/축소하고, 꺼져 있으면 비율을 유지하며 크기를 조정해요. 비틀기는 가까우면 가장 가까운 15도로 스냅되고 두 손가락 이동은 스냅되지 않아요. 첫 번째 손가락이 선택 위에 닿아야 하고 두 번째 손가락이 빠르게 뒤따라 선택 위나 가장자리 바로 바깥에 닿아야 해요. 다른 곳의 두 손가락은 보기를 확대/축소하고 이동하며, 아트보드나 잠긴 개체를 포함하거나, 보기 대부분을 덮거나, 가장자리를 넘어가는 선택 위의 두 손가락도 그래요.
:::

## 직접 도형 그리기

박스, 원, 둥근 프레임이 대부분의 레이아웃을 맡아요. 다른 모든 도형은 직접 그리세요. 레일의 **Pen** 버튼(또는 `P`)이 그리기 모드로 들어가게 해요. 단일 키 세 개로 모드를 오가요. Pointer는 `V`, Pen은 `P`, **Edit points**는 `N`이에요. 빠져나오는 길은 항상 Pointer예요.

- **클릭**하면 점을 놓아요. 기본 곡선 유형에서는 **클릭하고 끌면** 점의 핸들이 당겨져 곡선이 만들어지고, 클릭하면서 **Alt**를 누르면 뾰족한 모서리가 돼요. (다른 곡선 유형에서는 모든 점이 모서리이고 끌기는 아무 효과가 없어요.)
- 점은 놓을 때 아트보드와 다른 박스에 스냅돼요. Alt는 그리는 동안 격자를 끄고, 이후 점을 끌 때는 격자와 가장자리를 모두 꺼요.
- **첫 점을 클릭**하면 도형이 닫혀요. 아니면 **Enter**를 누르거나 더블클릭하거나 도구를 바꾸면 그림이 유지돼요.
- **Escape**는 한 단계씩 작동해요. 처음 누르면 그림을 포기하고, 두 번째로 누르면 펜에서 나가요.
- 그리는 중 **Delete**는 마지막 점을 지워요.

결과는 일반 박스예요. 다른 박스처럼 경로를 이동, 크기 조정, 회전, 그룹화, 정렬, 순서 변경, 채우기, 음영 또는 흐리게 할 수 있어요. 첫 번째 경로는 브랜드가 경로에 주는 채우기와 선을 받고, 이후 새 경로는 마지막에 쓴 것을 받아요. 브랜드가 경로에 아무것도 정하지 않은 도구에서는 새 경로가 그릴 때 쓴 색으로 선이 그려지므로 도형이 보이지 않는 일은 없어요.

**점 다시 편집하기.** 도형을 더블클릭하거나 개체 막대의 **Edit points**를 쓰세요. 점을 끌어 이동하고, 핸들을 끌어 곡선의 방향을 다시 잡고, 곡선을 클릭해 점을 삽입하고, 여러 점 주위에 상자를 끌고 Delete를 눌러요. 경로는 항상 점을 최소 두 개 유지해요.

**Spline type**은 점들을 지나는 곡선의 종류를 정해요.

| 유형 | 하는 일 |
|---|---|
| **Smooth (auto)** | 기본값. 핸들 길이를 스스로 계산하므로 단순한 클릭으로도 부드러운 곡선이 나와요. 설정한 핸들은 방향을 고정하고, 길이는 곡선이 관리해요. |
| **Bezier handles** | 전통적인 펜. 모든 핸들을 직접 조작하며, 점을 삽입해도 곡선이 움직이지 않아요. |
| **Through the points** | 핸들 없이 모든 점을 정확히 지나가요. |
| **B-spline** | 점을 지나지 않고 점 근처를 따라 흘러서 더 부드러운 선이 돼요. |
| **Straight lines** | 폴리라인. |

기존 경로를 스스로 핸들을 계산하는 유형으로 바꾸면 먼저 확인을 요청해요. 설정한 핸들 길이는 복구할 수 없기 때문이에요. **Bezier handles**로 바꾸는 것은 항상 손실이 없어요. 그리는 도중에는 전환이 바로 적용되고 당겨 둔 핸들은 사라져요.

각 점에는 모양으로 표시되는 연속성 규칙도 있어요. **Corner**는 사각형(핸들이 독립적으로 움직임), **Smooth**는 원(핸들이 일직선 유지), **Symmetric**은 고리가 있는 원(일직선이며 길이가 같음)이에요. 선택한 점에 규칙을 설정하면 곡선이 바로 따라와요.

![링크에서 곧바로 렌더링한 펜 패스 두 개 - 선으로 그린 S자 곡선과, 닫혀서 채워진 덩어리 도형](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

그린 경로는 다른 박스처럼 공유 링크에 담겨 이동하며 명령줄에서도 똑같이 렌더링돼요.

## 도형 결합

도형을 둘 이상 선택하고 캔버스를 우클릭(터치에서는 두 손가락 탭)한 뒤 다음 중에서 선택하세요.

- **Union**은 가장 위에 있는 도형의 페인트로 하나의 도형으로 합쳐요.
- **Subtract**는 위에 있는 모든 것을 아래 도형에서 잘라내요.
- **Intersect**는 겹치는 부분만 남겨요.
- **Exclude**는 겹치는 부분을 제외한 모든 것을 남겨요.

도형 하나에 작동하는 것이 세 가지 더 있어요. **Outline stroke…**는 선을 같은 굵기의 채워진 윤곽선으로 바꿔요. **Offset path…**는 윤곽선을 바깥으로 키우거나, 음수를 쓰면 안쪽으로 줄여요. **Simplify**는 같은 윤곽선으로 더 적은 세그먼트로 경로를 다시 만들어요.

![Subtract로 만든 초승달과 실제 구멍이 있는 고리](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

결과는 펜으로 계속 편집할 수 있는 새 경로이며 일반 베지어 곡선으로 저장되므로 원래의 스플라인 유형은 이어지지 않아요. 구멍은 실제 구멍이에요. 선 패널의 **Fill rule** 컨트롤이 겹치는 윤곽선을 채울지(*non-zero*) 뚫을지(*even-odd*)를 정해요. 이 연산은 파괴하지 않고 거부해요. 겹치지 않는 두 도형의 교집합을 요청하면 아무것도 바뀌지 않아요. 텍스트와 이미지 박스는 윤곽선이 없으므로 그대로 둬요.

## 디자인 안의 3D 장면과 도구

박스는 그림 이상을 담을 수 있어요. 아래 두 종류는 모두 렌더링된 이미지가 아니라 레시피를 보관하므로, 문서가 요청하는 크기와 시점에 맞춰 다시 그려지며 원본을 업데이트하면 그것을 쓰는 모든 디자인에 반영돼요.

### 3D 장면

레일의 추가 메뉴에서 **3D scene**을 선택하고 프레임을 끌어 그리면 3D Studio가 새 박스에서 열리고, 거기서 설정한 것이 캔버스로 돌아와요. 이후 Inspector의 **3D scene** 섹션에 있는 **Edit in 3D Studio**로 스튜디오를 다시 열 수 있어요. [Design에 장면 배치하기](/info/3d-studio.html#place-a-scene-in-design)에서 포스터, 타임라인, 내보내기, 공유를 다뤄요.

### 디자인 안의 도구

레일의 추가 메뉴에서 **Image**를 선택하고 프레임을 끌어 그린 뒤 선택기의 **Tools** 탭에서 도구를 고르세요. 도구가 기본값으로 프레임을 채우고, Inspector가 그 도구 자체 컨트롤이 있는 **Tool** 섹션으로 열려요. 필드를 바꾸면 잠시 후 박스가 업데이트되며 실행 취소 한 단계예요. **Image fit**과 **Image position**은 일반 그림처럼 작동하고, **Replace with another tool or image**는 박스의 콘텐츠를 교체해요.

**움직이는 도구**는 박스 안에서 재생돼요. 반복되는 일러스트는 캔버스에서 계속 반복되고, 타임라인이 열려 있으면 재생 헤드를 따라가며, GIF, MP4, WebM으로 프레임 단위로 내보내져요. 도구가 한 번 반복에 걸리는 시간을 알려주면 박스가 정확히 그 길이의 클립을 얻으므로 동영상이 반복 단위로 끝나요. 타이밍을 조정한 클립은 사용자의 타이밍을 유지하며, 도구의 모션을 끄면 박스가 다시 정지 그림이 돼요.

## 타임라인(시퀀스)

**Sequence**는 Design의 타임라인이며 캔버스에 시간을 더해요. 모든 박스는 특정 순간에 시작해 일정 길이 동안 실행되고 들어오고 나가며 애니메이션할 수 있으며, 아트보드 아래에 도킹된 타임라인에서 이들을 배열해요. Design의 **Video** 템플릿으로 시작하면 짧은 시퀀스가 이미 준비돼 있어요. 시퀀스 행에 타이밍이 있는 텍스트 카드 두 장과 그 아래의 절차적 음악 배경이 있어서, 아무것도 바꾸기 전에 타임라인이 어떻게 동작하는지 볼 수 있어요.

![시퀀스 타임라인: 트랜스포트, 눈금자, 오버레이 레인, 클립과 이음매 칩이 있는 자석형 시퀀스 행, Always on 스트립](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

행은 두 종류가 있어요.

- **시퀀스 행**은 자석식이에요. 클립이 끝에서 끝으로 이어지고, 하나를 끌면 순서가 바뀌며, 하나를 삭제하면 빈틈이 닫혀요. 이것이 중심축이에요.
- **오버레이 레인**은 자유로워요. 하단 자막, 로고, 캡션이 각자의 레인에서 자신의 시간에 중심축 위에 떠 있어요.
- 그 아래의 **Always on**에는 타이밍이 없어 내내 존재하는 박스가 있어요. 칩의 `+`는 하나를 레인으로 옮기고 **Make always on**은 다시 돌려보내요.

타임라인을 열면 키보드가 타임라인으로 넘어가므로 Space와 화살표 키가 재생 헤드를 조작해요. 이미 타이밍이 있는 구성은 타임라인이 저절로 열려요.

**편집.** 클립의 가운데를 끌어 이동하고, 양쪽 끝 근처를 끌어 다듬고, **Split at playhead**(또는 `S`)를 눌러 둘로 잘라요. 분할하려면 실제 **Length**가 있는 클립이 필요하고 재생 헤드가 클립 안쪽으로 조금 들어와 있어야 하므로, 음악 배경처럼 끝이 열린 클립은 분할할 수 없어요. **Snap to edges**는 기본으로 켜져 있어 클립 가장자리, 재생 헤드, 정수 초에 스냅해요. Alt를 누르고 끌면 스냅 없이 끌어요. 모든 끌기는 실행 취소 한 단계이며, 끄는 동안의 미리보기는 결과와 같은 계산을 사용해요.

클립을 선택하면 인스펙터가 같은 편집을 숫자로 제공해요. **Length**, **Trim in**(클립이 원본의 어디서 시작하는지), ×0.25에서 ×4까지의 **Speed**, 길이가 있는 **Animate in**과 **Animate out**, **Mute clip**이에요. 자석식 행의 클립에는 행이 순서를 관리하므로 **Start** 필드가 없어요.

**전환**은 프리셋이에요. Fade, Pop, Grow, Rise, Drop, 네 가지 Slide, Zoom in과 out, Tilt, Swoop, Spin, Drift 또는 **Cut (no animation)**이에요. 거리는 개체에 비례해서 조정되므로 하나의 프리셋이 전체 프레임 카드와 작은 배지에서 모두 자연스러워요. 시퀀스 행의 두 클립 사이에서 **이음매 칩**이 **Cut** 또는 **Crossfade**를 고르고, 다시 열어 **Length (ms)**를 설정한 뒤 **Done**을 누르세요. 크로스페이드에서는 첫 클립이 컷을 지나서도 계속 재생되며 페이드 아웃하고 다음 클립이 페이드 인하는데, 미리보기와 파일에서 같아요.

**소리.** **Audio** 클립은 파형, 다듬기, 음소거와 함께 다른 클립처럼 타임라인에 있어요. Video 템플릿의 생성된 음악 배경은 내보낼 때 합성되므로 렌더링하기 전까지 막대가 단순하고 무음이에요. 마이크를 누르면 카운트인과 레벨 미터와 함께 타임라인에 바로 **음성 해설을 녹음**해요. 녹음은 재생 헤드 위치에 사용자 자신의 에셋으로 저장돼요. 마이크 옆 카메라 버튼은 같은 방식으로 **동영상을 녹화**하며, 녹화하면서 아트보드로 잘라내므로 동료가 공유 링크로 클립을 추가할 수 있어요. 소리가 있는 클립을 선택하면 타임라인 아래에서 볼륨, 팬, EQ, 피치, 노멀라이즈, **Voice cleanup** 같은 효과를 위한 스트립이 열려요. 시퀀스 편집기 가이드의 [소리](/info/sequence-editor.html#sound)가 이 스트립을 다뤄요. 내보내기 패널의 **Audio track**은 별개로, 페이드와 더킹이 있는 클립 전체 아래의 배경 하나예요.

![음악 클립이 선택된 타임라인 - 아래쪽 스트립에 Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume, Effect 슬롯이 늘어서 있어요](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**렌더링.** 모션 내보내기는 각 프레임을 정확한 시간에 그리고, 디코딩하고, 인코딩하므로 파일이 기기의 처리 속도에 의존하지 않으며 MP4와 WebM에는 실질적인 프레임 한도가 없어요. 직접 입력하지 않으면 타임라인의 길이가 지속 시간을 정하고, Content Credentials는 다른 내보내기처럼 찍혀요. 스틸 내보내기는 재생 헤드 위치의 프레임을 주거나 **Frames** 필드에서 컨택트 시트를 줘요. [타이밍이 있는 구성의 스틸](/info/exporting.html#stills-from-a-timed-composition)을 참고하세요. 시퀀스는 최대 한 시간이에요. GIF와 애니메이션 PNG는 모든 프레임을 메모리에 보관하므로 짧은 클립에 적합해요. 프레임 단위 렌더링이 더 나은 경로이므로 여기서는 **Record live**가 숨겨져 있어요.

**키프레임, 깊이, 카메라.** 전환은 클립이 들어오고 나갈 때 애니메이션해요. 클립 안에서 박스의 자세를 잡으려면(흘러가기, 페이드, 흐림, 페이지에서 띄웠다가 다시 내려놓기) 클립을 선택하고 **+Keyframe**을 누르세요. 타임라인 도구의 다이아몬드, 캔버스 개체 막대의 다이아몬드, 또는 타임라인에 포커스가 있을 때 **Shift+K**예요. 재생 헤드의 위치가 다음 편집이 기록할 자세를 정해요. 같은 키프레임으로 타이밍이 있는 구성에 밀고 들어가고, 이동하고, 초점을 끌어오는 카메라를 줄 수 있어요. [애니메이션](/info/animating.html)이 전체 가이드이고, [시퀀스 편집기](/info/sequence-editor.html)가 선택, 어니언 스킨, 분할, 다듬기, 마커를 다뤄요.

## 내보내기 전에

Design은 파일을 보내기 전에 문서를 확인해요. Inspector의 **Document** 섹션과 내보내기 패널에 있는 **Before you export** 카드는 저장된 레이어 구조를 읽고, 안정된 캔버스에서 잘린 텍스트와 단색 대비를 살펴봐요. 각 텍스트 런에 임베드할 수 있는 글꼴 바이트가 있는지 SVG 및 PDF 아웃라인 작업에 쓰는 것과 같은 글꼴 레지스트리에 물어봐요. 이미지와 그라디언트 배경은 지어낸 대비 점수를 주는 대신 시각적 확인 항목으로 나열돼요.

### 디자인 시스템과 구성 비교 확인

내보내기 패널의 카드는 렌더링이 쓰는 것과 같은 디자인 시스템 버전으로 구성을 디자인 시스템과도 비교해요. 직접 정한 색상, 토큰 별칭, 글꼴 선택, 이미지 에셋 ID를 살펴봐요. 사용자 지정 값은 의도된 것일 수 있고, 선언된 브랜드 에셋 밖의 이미지는 금지된 이미지가 아니라 검토 항목이에요.

구체적인 색상이나 글꼴 제안이 있으면 그 버튼이 해당 레이어 하나를 바꾸고 **Undo**로 원래대로 복원돼요. 잠겼거나 이후 변경된 레이어는 오래된 제안으로 절대 덮어쓰이지 않아요. 그라디언트, 효과, 중첩된 도구 콘텐츠, 권리, 주관적 품질은 이 비교의 범위 밖이며, 어떤 검사도 Download를 막지 않아요.

### 조직 규칙과 글쓰기 신호

내보내기 패널의 카드는 디자인 시스템이 가져오는 조직 규칙도 레이어별로 확인해요. 텍스트 굵기와 정렬, 승인된 색상 조합, 표면당 로고 같은 것이에요. 각 결과는 규칙 위에 레이어 이름이 붙은 경고예요. 이 빌드에 검사기가 없는 규칙은 지켜졌다고 하지 않고 확인되지 않음으로 나열돼요. [Usage & rules](/info/brand-studio.html#usage-rules)가 규칙을 나열하며 `lolly check`는 저장된 문서에 같은 규칙을 적용해요.

같은 카드는 문서가 그리는 텍스트의 글쓰기 신호도 보여줘요. 등급(없음, 약함, 주목할 만함, 강함)과 100점 만점 점수 및 레이어별로 표시된 최대 세 개의 의심 문구가 담긴 Verify 자체의 문장이에요. **Open the text in Verify**는 전체 판독을 위해 그 텍스트를 [Verify](/#/verify)로 가져가요. [Verify의 AI 증거](/info/verify-ai-evidence.html)가 점수가 무엇을 따지는지 설명해요. 점수는 판정이 아니라 신호예요. 생성된 글에서 흔한 패턴을 세며 누가 썼는지는 알 수 없어요. 숨겨진 레이어는 두 검사에서 모두 제외되며 카드가 몇 개인지 알려줘요.

조직 규칙 결과와 강한 글쓰기 신호는 카드의 "to fix" 합계에 포함되어 쉽게 찾을 수 있어요. 알려주기만 하고 막지는 않아요. Download는 계속 사용할 수 있고 무시하거나 예외로 기록할 것도 없어요. 열린 문서에서 작업하는 에이전트는 사이트 도구를 통해 같은 보고서를 받아요([열린 문서의 에이전트](/info/open-document-agents.html)).

**Settings → Feature flags → Print preflight**를 켜면 인쇄 검사(도련, 해상도, 잉크 커버리지, 판 수)가 같은 카드에 추가돼요. 다른 도구에서는 이 플래그가 카드를 아예 표시해요. [파일 내보내기](/info/exporting.html)가 인쇄 검사를 설명해요.

## 발표하기

아트보드로 이루어진 Design 문서는 이미 덱이에요. 상단 막대의 **Present**를 누르면 각 아트보드가 캔버스에 놓인 순서대로 전체 화면 슬라이드가 돼요. 문서의 **Design outcome**이 **Slides**가 될 때까지 버튼에는 **Preview**라고 표시돼요. 덱은 렌더링된 아트보드의 사본에서 실행되므로 나가면 정확히 있던 곳으로 돌아가요.

**Present** 옆 화살표는 **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)**, **Export slides as video**를 열어요.

| 키 | 하는 일 |
|---|---|
| **Space**, `→`, **Page Down** | 다음 단계 또는 슬라이드(또는 오른쪽 가장자리의 띠를 클릭) |
| `←`, **Page Up** | 뒤로(또는 왼쪽 가장자리의 띠를 클릭) |
| **Home**, **End** | 첫 번째 또는 마지막 슬라이드 |
| `O` | 개요: 캔버스 배치대로 모든 아트보드를 보여주며 하나를 클릭하면 열려요 |
| `S` | 발표자 보기: 현재 슬라이드, 다음 슬라이드, 노트, 시계가 있는 두 번째 창 |
| `B` | 검은 화면. 아무 키나 누르면 슬라이드가 돌아와요 |
| `F` | 전체 화면으로 돌아가기 |
| `K` | 키오스크 덱 일시 정지 또는 다시 시작 |
| **Escape** | 한 겹 벗기기: 개요에서 덱으로, 덱에서 편집기로 |

포인터를 움직이면 작은 컨트롤 막대가 나타나고 멈추면 다시 숨어요. 브라우저가 발표자 팝업을 차단하면 발표자 보기가 덱 위의 패널로 열려요. 노트는 각 아트보드에 속하며 슬라이드에는 나타나지 않아요.

- **단계별 표시.** 박스를 우클릭해서 **Always visible** 대신 **Reveal at step 1**, **2**, **3**을 선택하면, 박스가 해당 단계로 넘어갈 때까지 기다려요. 같은 번호를 공유하는 박스는 함께 나타나요.
- **키오스크.** 아트보드에 **Length**를 주면 덱이 그 시간 동안 머문 뒤 얇은 진행 막대 뒤에서 넘어가요. 링크에 `kiosk`를 추가하면 덱이 끝에서 처음으로 돌아가 사이니지에 쓸 수 있어요.
- **하위 슬라이드 스택.** 아트보드를 우클릭하고 **Stack under the previous slide**를 선택하면 앞 슬라이드의 한 단계가 돼요. 개요에는 카드가 하나 보이고 인스펙터의 **Stack** 행이 아트보드가 속한 슬라이드를 알려줘요.
- **모프.** 연속한 두 슬라이드에 같은 **Morph match** 이름(예: `hero`)의 박스가 있으면, 전환이 컷 대신 그 박스를 이동하고, 크기를 조정하고, 색을 바꿔요. 덱 전체의 **Morph** 전환은 일치하는 모든 쌍에 같은 일을 해요.
- **내레이션.** 각 아트보드의 **Speaker notes**를 소리 내어 읽을 수 있어요. Inspector의 **Document** 섹션에서 **Voice**를 고르고, 선택적으로 **Blend with**할 두 번째 음성, **Speed**, 밀리초 단위의 **Lead-in**과 **Tail**을 설정하세요. **Show captions when presenting**은 말하는 대로 단어를 보여줘요. 음성은 기기에서 실행되며, 같은 노트가 동영상 내보내기의 사운드트랙, PowerPoint 내보내기의 슬라이드 오디오, [SCORM 패키지](/info/create/exporting.html#scorm-course-packages)의 내레이션 영상이 돼요.

덱도 링크예요. `?present`는 바로 덱으로 열리고 `s=`는 슬라이드(위치, 아트보드 ID, 빌드 단계는 `id.step`)를 고르며 주소가 따라오므로 보내는 것은 현재 보고 있는 슬라이드예요. [예약된 URL 매개변수](/info/url-parameters.html#what-happens-on-open)가 이를 설명해요.

**Present with camera**는 카메라, 로고, 이름 캡션을 슬라이드 위에 올리고 비공개 컨트롤과 저장된 장면을 제공해요. [카메라로 발표하기](/info/presenting.html)를 참고하세요. 발표 중에는 인스펙터에서 **Make interactive**를 켜면 **Web page** 박스가 클리커를 받을 수 있어요. **Focus on click** 단계에서 Up과 Down은 페이지를 조작하고 Next는 덱을 계속해요. [클리커를 받는 라이브 페이지](/info/interactive-pages.html)가 포커스 스타일, 스크롤 정지, 사이트 승인을 다뤄요.

## 다음으로 갈 곳

- **[Design의 텍스트](/info/text-composition.html)**: 캔버스에서 텍스트 편집, 프레임을 통한 글 흐름, 타이포그래피를 다뤄요.
- **[애니메이션](/info/animating.html)**: 키프레임, 깊이, 장면 카메라, Lift layers를 다뤄요.
- **[디자인 가져오기](/info/design-import.html)**: Figma, Penpot, Illustrator, InDesign 파일을 편집 가능한 박스로 열어요.
- **[규칙과 함께 디자인 공유하기](/info/create-a-tool.html)**: Design 문서를 선택한 입력만 있는 도구로 바꿔요.
- **[파일 내보내기](/info/exporting.html)**: 형식, 크기, 인쇄 단위, 동영상을 다뤄요.
