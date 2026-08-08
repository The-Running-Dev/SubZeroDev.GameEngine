/**
 * "The Bureaucracy" — Bulgarian translation (W60, `design/30-slices.md`).
 *
 * Contract: `04-core.md` §10.1 — additional locales are string tables plus tooling, no
 * type change. Same campaign id, namespace, node/route/ending ids, and structure as
 * `bulgaria-bureaucracy.ts`'s English source; only every `AuthoredText.text` is
 * translated. Because `StoryGraphCampaign` content carries only `LocKey`s (never raw
 * text), `buildStoryGraphCampaign` on this source produces byte-identical `content` to
 * the English build — proven in `bulgaria-bureaucracy.locale.test.ts` — and the two
 * differ only in the `strings` table each build produces.
 */

import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, type AdventureConfig } from "./adventure-builder.js";
import { BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";

const configBG: AdventureConfig = {
  id: BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
  namespace: "bureaucracy",
  title: "Бюрокрацията",
  description: "Общински случай през кадастъра, данъчната служба, регистъра, архива, нотариуса и бюрото за преводи.",
  startNodeId: "municipality",
  intro: "Пристигате в общината в 08:03. Офисът отвори в 08:00. Ръкописна бележка казва, че срещата свършва в 11:30; три съседни врати не са съгласни за годината.",
  statLabels: { preparation: "Документи", connections: "Благоразположение на чиновника", pressure: "Административен натиск" },
  routes: [
    {
      id: "registry_route", choiceId: "wait", label: "Изчакайте общинския регистър", memoryLabel: "услужливият чиновник",
      scenes: [
        "Чиновник преглежда папката ви и тихо отбелязва единствения сертификат, който изтича първи.",
        "Кадастралната служба разпознава адреса, но не и сградата, а сградата не разпознава нито едното.",
        "Данъчното гише изисква доказателство, че имотът съществува, преди да обясни защо дължи данък.",
        "Обратно в регистъра, папката ви е достатъчно дебела, за да заслужи професионално уважение. Последният печат вече е въпрос на метод.",
      ],
      actionLabels: [
        "Благодарете на чиновника и отбележете датата на изтичане",
        "Незабавно поискайте супервайзора",
        "Копирайте написания на ръка списък на чиновника",
        "Използвайте официалния списък от 2019",
        "Поръчайте първо кадастралната скица",
        "Донесете данъчната квитанция, която вече имате",
        "Помолете данъчния чиновник да се обади горе",
        "Изчакайте на опашка отново с нов номер",
      ],
      eventLabels: [
        "Написаният на ръка списък сочи единствената копирна служба, чийто печат е обърнат в правилната посока.",
        "Официалният списък пропуска сертификат, който сега се изисква от чиновника, отпечатал го.",
        "Данъчният чиновник се свързва с кадастралното гише по телефона и двамата откриват общ братовчед.",
        "Номерът ви е повикан през дванадесетте секунди, в които четете табелото.",
      ],
      endings: [
        { id: "document_obtained", title: "Документът е получен", text: "Хартията пристига с три печата и без извинение. Тя доказва факта, който всички знаеха преди закуска.", outcome: "win" },
        { id: "miracle", title: "Административното чудо", text: "Чиновникът си спомня учтивостта ви, открива липсващия запис и извършва деяние, което бъдещите служители ще отричат, че е било възможно.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "archive_route", choiceId: "ask_guard", label: "Помолете пазача за неофициалния маршрут", memoryLabel: "услугата от архива",
      scenes: [
        "Пазачът ви изпраща през гражданския регистър, един етаж надолу и двадесет и седем години назад.",
        "Каталогът на архива вписва досието ви под изписване, използвано веднъж от уморена машинописка през 1987 година.",
        "Бюрото за преводи може да завери старото изписване, ако нотариус завери, че новото изписване е ваше.",
        "Възстановената папка стига до адвокат, чието спокойствие струва по-малко от още една седмица опашки и повече от обяд.",
      ],
      actionLabels: [
        "Запишете номерата на стаите, които пазачът каза",
        "Приемете указанията като фолклор",
        "Претърсете ръкописния индекс на архива",
        "Платете за компютризирано търсене",
        "Помолете преводача да обясни несъответствието",
        "Посетете нотариуса без предварително обаждане",
        "Оставете адвоката да носи папката",
        "Върнете се лично в стая 14",
      ],
      eventLabels: [
        "Ръкописният индекс съдържа препратка, изписана с безупречно синьо мастило.",
        "Базата данни връща девет граждани, две улици и разрешително за добитък.",
        "Преводачът познава нотариуса и коригира срещата, преди тя да изчезне.",
        "Стая 14 ви изпраща в стая 6; стая 6 е преобзаведена, но помни уговорката.",
      ],
      endings: [
        { id: "lawyer_solved", title: "Адвокат за живите", text: "Адвокатът подава едно точно писмо. Системата, изправена пред граматика, отстъпва.", outcome: "win", gate: "memory" },
        { id: "gave_up", title: "Папката в шкафа", text: "Прибирате папката. Общината не отбелязва поражение; просто спира да чува за вас.", outcome: "neutral" },
      ],
    },
    {
      id: "supervisor_route", choiceId: "coffee", label: "Вземете кафе и намерете супервайзора", memoryLabel: "обещанието на супервайзора",
      scenes: [
        "В кафенето срещате заместник-супервайзор, който помни случая ви и, по-опасно, обещава да го разгледа.",
        "Гражданският регистър приема обещанието като доказателство, но бюрото за преводи го иска писмено.",
        "Нотариус преглежда растящата купчина и задава единствения полезен въпрос, зададен днес.",
        "Супервайзорът свиква три гишета около един компютър. Или случаят ще се реши, или системата най-накрая ще опише възражението си.",
      ],
      actionLabels: [
        "Оставете супервайзора да си допие кафето",
        "Започнете със седемгодишната история",
        "Поискайте обещанието по имейл",
        "Цитирайте обещанието по памет",
        "Отговорете честно на въпроса на нотариуса",
        "Добавете още един сертификат, за всеки случай",
        "Съберете всички на едно гише",
        "Подайте отделни копия на всяко гише",
      ],
      eventLabels: [
        "Супервайзорът записва директния си номер на салфетка, най-трайният носител на общината.",
        "Пълната ви хронология предизвиква второ кафе и никакъв измерим напредък.",
        "Имейлът пристига с тема, която внезапно прави три офиса склонни да сътрудничат.",
        "Допълнителният сертификат противоречи на формуляр, който никой не беше забелязал досега.",
      ],
      endings: [
        { id: "system_failure", title: "Системен срив, човешки успех", text: "Регистърът се срива, докато всички гледат. Супервайзорът подписва хартиен резервен вариант, използван за последно преди Wi-Fi.", outcome: "neutral", gate: "memory" },
        { id: "ultimate_reward", title: "Върховната българска награда", text: "След седем години документи получавате €300 и двадесет и осем години нерешена правна отговорност.", outcome: "win" },
      ],
    },
  ],
  startAliases: [{ id: "try_another_entrance", label: "Опитайте входа през архива", routeId: "archive_route" }],
  retainedAchievements: [
    {
      id: "it_builds_character",
      name: { key: "bureaucracy.ach.it_builds_character.name", text: "Изгражда характер" },
      description: { key: "bureaucracy.ach.it_builds_character.description", text: "Достигнете развръзка, след като офисите са изпитали всеки наличен вид търпение." },
      condition: { field: "ending", operator: "not_equals", value: undefined },
      hidden: false,
    },
  ],
};

export const bulgariaBureaucracySourceBG: StoryGraphCampaignSource = createAdventureSource(configBG);

/**
 * Builds the same `bulgaria-bureaucracy` campaign against the Bulgarian source. No
 * `migrateState` is attached — this build exists to prove the second-locale registry and
 * client rendering (W60), not a second persisted campaign; migration is the English
 * build's concern (`buildBulgariaBureaucracyCampaign`, `bulgaria-bureaucracy.ts`).
 */
export function buildBulgariaBureaucracyCampaignBG(source: StoryGraphCampaignSource = bulgariaBureaucracySourceBG): CommandResult<BuiltCampaign> {
  return buildAdventureCampaign(configBG, source);
}
