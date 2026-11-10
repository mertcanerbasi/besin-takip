# Besin Takip

Günlük kalori, makro ve öğün planı takibi. Statik bir sitedir, GitHub Pages üzerinde çalışır.

## Özellikler
- Öğün öğün kayıt (Kahvaltı, Öğle, Akşam, Ara öğün). Her kayıt **yendi** ya da **planlandı** olarak işaretlenir.
- Gelecek günleri planlama, başka bir günden öğün veya gün kopyalama, planı tek dokunuşla "yendi" yapma.
- Kalori ve makro (protein, karbonhidrat, yağ) hedefi. Halka ve çubuklarla yenen, planlanan ve kalan miktar gösterilir.
- Hedef hesaplayıcı: Mifflin-St Jeor ile BMR ve TDEE, kilo verme/koruma/alma hedefi, g/kg protein ve % yağ ayarı.
- Su takibi ve gün notu.
- Kilo ve vücut ölçüleri (bel, kalça, göğüs, kol, bacak, boyun, yağ %). Hareketli ortalamalı grafik ve VKİ.
- Raporlar: 7 gün ile 1 yıl arası ortalamalar, hedef uyumu, protein hedefine ulaşma, kalori dengesi, gün gün tablo.
- Yaklaşık 140 hazır Türk mutfağı ve temel gıda (100 g başına). Kendi besinlerini porsiyonlarıyla ekleyebilirsin.

## Veri güvenliği: geçmiş neden kaybolmaz
- Veriler ayrı bir **private** repoda (`besin-takip-data`) JSON olarak tutulur. Her değişiklik bir commit olduğundan, git geçmişi her sürümü saklar.
- Kayıt önce tarayıcıdaki IndexedDB'ye yazılır, ardından GitHub'a gönderilir. İnternet yoksa değişiklikler bekler ve bağlantı gelince otomatik gönderilir.
- Silme işlemleri kaydı fiziksel olarak silmez; kayıt yalnızca "silindi" olarak işaretlenir.
- Aynı dosya iki cihazda değişirse kayıt bazında birleştirilir.
- Geçmiş günler, kendi tarihindeki hedefi saklar. Hedefi değiştirmek eski raporları değiştirmez.
- Ayarlar sayfasından tüm veriyi JSON olarak indirip yedekleyebilirsin.

### Veri reposunun yapısı
```
data/profile.json                  profil + hedefler
data/body.json                     vücut ölçüleri
data/foods.json                    özel besinler
data/days/2026/11/2026-11-10.json  günlük kayıtlar
```

## Kurulum (bir kerelik)
1. GitHub'da `besin-takip-data` adında **private** bir repo aç.
2. [Fine-grained token](https://github.com/settings/personal-access-tokens/new) oluştur:
   - Repository access: yalnızca `besin-takip-data`
   - Permissions → Contents: **Read and write**
3. Siteyi aç, **Ayarlar → Veri saklama** bölümüne kullanıcı adını, repo adını ve token'ı gir.

Token yalnızca girdiğin tarayıcıda saklanır. Her cihazda bir kez girmen gerekir.

## Geliştirme
Derleme adımı yoktur. Düz HTML, CSS ve ES modüllerinden oluşur.
```
python3 -m http.server 8000
```
